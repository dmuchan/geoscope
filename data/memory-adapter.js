const demoLayers = require("./demo-data");
const {
  assignFeatureIds,
  clone,
  computeBBox,
  ensureUniqueIdentifier,
  extractFields,
  featureCollection,
  inferGeometryType,
  normalizeGeoJSON,
  searchInProperties,
  slugifyIdentifier,
} = require("./utils");

class MemoryAdapter {
  constructor() {
    this.resetDemo();
  }

  get mode() {
    return "memory";
  }

  resetDemo() {
    this.layers = clone(demoLayers).map((layer) => ({
      ...layer,
      fields: extractFields(layer.features),
      featureCount: layer.features.length,
      bbox: computeBBox(layer.features),
    }));
  }

  async health() {
    return { ok: true, mode: this.mode };
  }

  async listLayers() {
    return this.layers.map(({ features, ...layer }) => layer);
  }

  async getLayer(layerId) {
    return this.layers.find((layer) => layer.id === layerId) || null;
  }

  async getLayerGeoJSON(layerId, query = "") {
    const layer = await this.getLayer(layerId);
    if (!layer) {
      return null;
    }

    const features = layer.features.filter((feature) => searchInProperties(feature.properties, query));
    return featureCollection(features);
  }

  async getLayerFields(layerId) {
    const layer = await this.getLayer(layerId);
    return layer ? layer.fields : null;
  }

  async getLayerAttributes(layerId, options = {}) {
    const layer = await this.getLayer(layerId);
    if (!layer) {
      return null;
    }

    const query = options.query || "";
    const limit = Number(options.limit || 20);
    const offset = Number(options.offset || 0);
    const filtered = layer.features.filter((feature) => searchInProperties(feature.properties, query));
    const items = filtered.slice(offset, offset + limit).map((feature) => ({
      featureId: feature.id,
      geometryType: feature.geometry.type,
      properties: feature.properties,
    }));

    return {
      total: filtered.length,
      limit,
      offset,
      items,
    };
  }

  async getLayerStats(layerId) {
    const layer = await this.getLayer(layerId);
    if (!layer) {
      return null;
    }

    const geometryBreakdown = layer.features.reduce((accumulator, feature) => {
      accumulator[feature.geometry.type] = (accumulator[feature.geometry.type] || 0) + 1;
      return accumulator;
    }, {});

    return {
      featureCount: layer.featureCount,
      bbox: layer.bbox,
      geometryBreakdown,
      fields: layer.fields,
    };
  }

  async importLayer(payload) {
    const normalized = normalizeGeoJSON(payload.geojson);
    const existingIds = new Set(this.layers.map((layer) => layer.id));
    const layerId = ensureUniqueIdentifier(slugifyIdentifier(payload.layerName), existingIds);
    const features = assignFeatureIds(clone(normalized.features), layerId);
    const layer = {
      id: layerId,
      name: payload.layerName,
      description: payload.layerDescription || "",
      geometryType: inferGeometryType(features),
      color: payload.layerColor || "#3e8b85",
      source: payload.source || "upload",
      originalFilename: payload.originalFilename || null,
      features,
      fields: extractFields(features),
      featureCount: features.length,
      bbox: computeBBox(features),
    };

    this.layers.push(layer);
    return {
      id: layer.id,
      name: layer.name,
      featureCount: layer.featureCount,
      geometryType: layer.geometryType,
    };
  }
}

module.exports = MemoryAdapter;
