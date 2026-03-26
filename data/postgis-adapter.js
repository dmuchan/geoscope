const {
  assignFeatureIds,
  ensureUniqueIdentifier,
  inferGeometryType,
  normalizeGeoJSON,
  slugifyIdentifier,
} = require("./utils");

class PostGISAdapter {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
    this.pool = null;
  }

  get mode() {
    return "postgis";
  }

  async getPool() {
    if (this.pool) {
      return this.pool;
    }

    let pgModule;
    try {
      pgModule = require("pg");
    } catch (error) {
      throw new Error("PostGIS 模式需要先执行 npm install 安装 pg 依赖。");
    }

    this.pool = new pgModule.Pool({
      connectionString: this.databaseUrl,
    });
    return this.pool;
  }

  async query(text, params = []) {
    const pool = await this.getPool();
    return pool.query(text, params);
  }

  async health() {
    await this.query("select 1");
    return { ok: true, mode: this.mode };
  }

  async listLayers() {
    const sql = `
      select
        l.id,
        l.name,
        l.description,
        l.geometry_type as "geometryType",
        l.style_color as color,
        l.source,
        coalesce(count(f.id), 0)::int as "featureCount"
      from gis_layers l
      left join gis_features f on f.layer_id = l.id
      group by l.id
      order by l.sort_order asc, l.name asc
    `;
    const { rows } = await this.query(sql);
    return rows;
  }

  async getLayer(layerId) {
    const sql = `
      select
        l.id,
        l.name,
        l.description,
        l.geometry_type as "geometryType",
        l.style_color as color,
        l.source
      from gis_layers l
      where l.id = $1
    `;
    const { rows } = await this.query(sql, [layerId]);
    return rows[0] || null;
  }

  async getLayerGeoJSON(layerId, query = "") {
    const sql = `
      select json_build_object(
        'type', 'FeatureCollection',
        'features', coalesce(json_agg(feature), '[]'::json)
      ) as geojson
      from (
        select json_build_object(
          'type', 'Feature',
          'id', f.id,
          'properties', f.properties,
          'geometry', st_asgeojson(f.geom)::json
        ) as feature
        from gis_features f
        where f.layer_id = $1
          and ($2 = '' or f.properties::text ilike '%' || $2 || '%')
        order by f.id
      ) features
    `;
    const { rows } = await this.query(sql, [layerId, query]);
    return rows[0]?.geojson || null;
  }

  async getLayerFields(layerId) {
    const sql = `
      with sampled as (
        select properties
        from gis_features
        where layer_id = $1
        limit 500
      )
      select
        each.key as name,
        coalesce(
          case
            when count(distinct jsonb_typeof(each.value)) = 1 then max(jsonb_typeof(each.value))
            else 'mixed'
          end,
          'unknown'
        ) as type,
        array_remove(array_agg(distinct trim(both '"' from each.value::text)) filter (where each.value is not null), null)[1:5] as samples
      from sampled
      cross join lateral jsonb_each(sampled.properties) as each
      group by each.key
      order by each.key
    `;
    const { rows } = await this.query(sql, [layerId]);
    return rows;
  }

  async getLayerAttributes(layerId, options = {}) {
    const query = options.query || "";
    const limit = Number(options.limit || 20);
    const offset = Number(options.offset || 0);
    const sql = `
      select
        f.id as "featureId",
        GeometryType(f.geom) as "geometryType",
        f.properties
      from gis_features f
      where f.layer_id = $1
        and ($2 = '' or f.properties::text ilike '%' || $2 || '%')
      order by f.id
      limit $3
      offset $4
    `;
    const countSql = `
      select count(*)::int as total
      from gis_features f
      where f.layer_id = $1
        and ($2 = '' or f.properties::text ilike '%' || $2 || '%')
    `;
    const [rowsResult, countResult] = await Promise.all([
      this.query(sql, [layerId, query, limit, offset]),
      this.query(countSql, [layerId, query]),
    ]);

    return {
      total: countResult.rows[0]?.total || 0,
      limit,
      offset,
      items: rowsResult.rows,
    };
  }

  async getLayerStats(layerId) {
    const summarySql = `
      select
        count(*)::int as "featureCount",
        st_asgeojson(st_envelope(st_extent(geom))::geometry)::json as bbox
      from gis_features
      where layer_id = $1
    `;
    const geometrySql = `
      select GeometryType(geom) as type, count(*)::int as count
      from gis_features
      where layer_id = $1
      group by GeometryType(geom)
    `;
    const [summaryResult, geometryResult, fields] = await Promise.all([
      this.query(summarySql, [layerId]),
      this.query(geometrySql, [layerId]),
      this.getLayerFields(layerId),
    ]);

    const geometryBreakdown = geometryResult.rows.reduce((accumulator, row) => {
      accumulator[row.type] = row.count;
      return accumulator;
    }, {});

    const bboxGeometry = summaryResult.rows[0]?.bbox;
    let bbox = null;
    if (bboxGeometry?.coordinates?.[0]) {
      const coordinates = bboxGeometry.coordinates[0];
      const lngs = coordinates.map((coordinate) => coordinate[0]);
      const lats = coordinates.map((coordinate) => coordinate[1]);
      bbox = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    }

    return {
      featureCount: summaryResult.rows[0]?.featureCount || 0,
      bbox,
      geometryBreakdown,
      fields,
    };
  }

  async importLayer(payload) {
    const normalized = normalizeGeoJSON(payload.geojson);
    const client = await (await this.getPool()).connect();

    try {
      await client.query("begin");

      const layerId = await this.createUniqueLayerId(client, slugifyIdentifier(payload.layerName));
      const features = assignFeatureIds(normalized.features, layerId);
      const geometryType = inferGeometryType(features);
      const sortOrderResult = await client.query("select coalesce(max(sort_order), 0) + 10 as next from gis_layers");
      const sortOrder = sortOrderResult.rows[0]?.next || 10;

      await client.query(
        `
          insert into gis_layers (id, name, description, geometry_type, style_color, source, sort_order)
          values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          layerId,
          payload.layerName,
          payload.layerDescription || "",
          geometryType,
          payload.layerColor || "#3e8b85",
          payload.source || "upload",
          sortOrder,
        ]
      );

      for (const feature of features) {
        await client.query(
          `
            insert into gis_features (id, layer_id, properties, geom)
            values ($1, $2, $3::jsonb, st_setsrid(st_geomfromgeojson($4), 4326))
          `,
          [
            String(feature.id),
            layerId,
            JSON.stringify(feature.properties || {}),
            JSON.stringify(feature.geometry),
          ]
        );
      }

      await client.query("commit");
      return {
        id: layerId,
        name: payload.layerName,
        featureCount: features.length,
        geometryType,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async createUniqueLayerId(client, baseId) {
    const existingIdsResult = await client.query("select id from gis_layers");
    const existingIds = new Set(existingIdsResult.rows.map((row) => row.id));
    return ensureUniqueIdentifier(baseId, existingIds);
  }
}

module.exports = PostGISAdapter;
