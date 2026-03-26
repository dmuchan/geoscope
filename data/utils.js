function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectCoordinates(geometry, bucket = []) {
  if (!geometry) {
    return bucket;
  }

  const { type, coordinates } = geometry;
  if (type === "Point") {
    bucket.push(coordinates);
    return bucket;
  }

  if (type === "LineString" || type === "MultiPoint") {
    coordinates.forEach((coordinate) => bucket.push(coordinate));
    return bucket;
  }

  if (type === "Polygon" || type === "MultiLineString") {
    coordinates.flat().forEach((coordinate) => bucket.push(coordinate));
    return bucket;
  }

  if (type === "MultiPolygon") {
    coordinates.flat(2).forEach((coordinate) => bucket.push(coordinate));
  }

  return bucket;
}

function computeBBox(features) {
  const points = [];
  features.forEach((feature) => collectCoordinates(feature.geometry, points));
  if (!points.length) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  return [minLng, minLat, maxLng, maxLat];
}

function searchInProperties(properties, query) {
  if (!query) {
    return true;
  }
  return JSON.stringify(properties).toLowerCase().includes(query.toLowerCase());
}

function inferFieldType(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function mergeFieldTypes(currentType, nextType) {
  if (!currentType || currentType === nextType) {
    return nextType;
  }
  return "mixed";
}

function extractFields(features) {
  const fieldMap = new Map();

  features.forEach((feature) => {
    const properties = feature.properties || {};
    Object.entries(properties).forEach(([key, value]) => {
      const current = fieldMap.get(key) || { name: key, type: null, samples: new Set() };
      current.type = mergeFieldTypes(current.type, inferFieldType(value));
      if (current.samples.size < 5 && value !== null && value !== undefined) {
        current.samples.add(String(value));
      }
      fieldMap.set(key, current);
    });
  });

  return [...fieldMap.values()].map((field) => ({
    name: field.name,
    type: field.type || "unknown",
    samples: [...field.samples],
  }));
}

function featureCollection(features) {
  return { type: "FeatureCollection", features };
}

function normalizeGeoJSON(rawData) {
  if (!rawData || typeof rawData !== "object" || !rawData.type) {
    throw new Error("缺少有效的 GeoJSON type 字段。");
  }

  if (rawData.type === "FeatureCollection") {
    if (!Array.isArray(rawData.features) || !rawData.features.length) {
      throw new Error("GeoJSON FeatureCollection 不能为空。");
    }
    return rawData;
  }

  if (rawData.type === "Feature") {
    if (!rawData.geometry) {
      throw new Error("GeoJSON Feature 缺少 geometry。");
    }
    return { type: "FeatureCollection", features: [rawData] };
  }

  throw new Error("仅支持 GeoJSON Feature 或 FeatureCollection。");
}

function slugifyIdentifier(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `uploaded_layer_${Date.now()}`;
}

function ensureUniqueIdentifier(baseId, existingIds) {
  let candidate = baseId;
  let index = 2;
  while (existingIds.has(candidate)) {
    candidate = `${baseId}_${index}`;
    index += 1;
  }
  return candidate;
}

function inferGeometryType(features) {
  const types = [...new Set(features.map((feature) => feature.geometry?.type).filter(Boolean))];
  if (!types.length) {
    return "Unknown";
  }
  if (types.length === 1) {
    return types[0];
  }
  return "Mixed";
}

function assignFeatureIds(features, layerId) {
  return features.map((feature, index) => ({
    ...feature,
    id: feature.id || `${layerId}_feature_${index + 1}`,
    properties: { ...(feature.properties || {}) },
  }));
}

module.exports = {
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
};
