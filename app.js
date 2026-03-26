const state = {
  config: null,
  layers: new Map(),
  featureRegistry: new Map(),
  activeLayerId: null,
  attributeQuery: "",
  selection: { a: null, b: null },
  tableSelectedFeature: null, // 属性表当前选中的要素
  thematic: {
    layerId: null,
    field: "",
    type: null,
    stops: [],
  },
};

const map = L.map("map", { zoomControl: false }).setView([31.228, 121.486], 12);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const resultLayerGroup = L.geoJSON(null, {
  style: {
    color: "#c75050",
    weight: 3,
    fillOpacity: 0.18,
  },
  pointToLayer: (_, latlng) =>
    L.circleMarker(latlng, {
      radius: 9,
      color: "#c75050",
      fillColor: "#c75050",
      weight: 3,
      fillOpacity: 0.35,
    }),
}).addTo(map);

const refs = {
  systemMode: document.querySelector("#systemMode"),
  datasetStatus: document.querySelector("#datasetStatus"),
  uploadCapability: document.querySelector("#uploadCapability"),
  uploadLayerName: document.querySelector("#uploadLayerName"),
  uploadLayerDescription: document.querySelector("#uploadLayerDescription"),
  uploadLayerColor: document.querySelector("#uploadLayerColor"),
  uploadFile: document.querySelector("#uploadFile"),
  uploadBtn: document.querySelector("#uploadBtn"),
  clearUploadBtn: document.querySelector("#clearUploadBtn"),
  uploadHint: document.querySelector("#uploadHint"),
  reloadBtn: document.querySelector("#reloadBtn"),
  resetDemoBtn: document.querySelector("#resetDemoBtn"),
  layerList: document.querySelector("#layerList"),
  activeLayerSelect: document.querySelector("#activeLayerSelect"),
  attributeQuery: document.querySelector("#attributeQuery"),
  queryBtn: document.querySelector("#queryBtn"),
  clearQueryBtn: document.querySelector("#clearQueryBtn"),
  layerStats: document.querySelector("#layerStats"),
  themeFieldSelect: document.querySelector("#themeFieldSelect"),
  applyThemeBtn: document.querySelector("#applyThemeBtn"),
  clearThemeBtn: document.querySelector("#clearThemeBtn"),
  themeLegend: document.querySelector("#themeLegend"),
  selectionTarget: document.querySelector("#selectionTarget"),
  selectionA: document.querySelector("#selectionA"),
  selectionB: document.querySelector("#selectionB"),
  bufferRadius: document.querySelector("#bufferRadius"),
  clearLogBtn: document.querySelector("#clearLogBtn"),
  resultLog: document.querySelector("#resultLog"),
  attributeSummary: document.querySelector("#attributeSummary"),
  attributeTableBody: document.querySelector("#attributeTableBody"),
};

refs.reloadBtn.addEventListener("click", () => initializeData(true));
refs.uploadBtn.addEventListener("click", uploadLayer);
refs.clearUploadBtn.addEventListener("click", resetUploadForm);
refs.resetDemoBtn.addEventListener("click", resetDemoData);
refs.queryBtn.addEventListener("click", () => {
  state.attributeQuery = refs.attributeQuery.value.trim();
  refreshActiveLayerPanel();
});
refs.clearQueryBtn.addEventListener("click", () => {
  refs.attributeQuery.value = "";
  state.attributeQuery = "";
  refreshActiveLayerPanel();
});
refs.activeLayerSelect.addEventListener("change", async (event) => {
  state.activeLayerId = event.target.value;
  await refreshActiveLayerPanel();
  renderLayerList();
  highlightLayerWithFlash(state.activeLayerId);
});
refs.applyThemeBtn.addEventListener("click", applyTheme);
refs.clearThemeBtn.addEventListener("click", clearTheme);
refs.clearLogBtn.addEventListener("click", () => {
  refs.resultLog.innerHTML = "";
  addLog("日志已清空。");
});

document.querySelector("#bufferBtn").addEventListener("click", runBufferAnalysis);
document.querySelector("#intersectBtn").addEventListener("click", runIntersectionAnalysis);
document.querySelector("#pipBtn").addEventListener("click", runPointInPolygonAnalysis);
document.querySelector("#focusBtn").addEventListener("click", fitVisibleLayers);

initializeData(false);

async function initializeData(showReloadLog, preferredLayerId = state.activeLayerId) {
  try {
    state.layers.forEach((layer) => {
      if (layer.leafletLayer) {
        map.removeLayer(layer.leafletLayer);
      }
    });

    const [config, layersResponse] = await Promise.all([
      apiGet("/api/config"),
      apiGet("/api/layers"),
    ]);

    state.config = config;
    state.layers.clear();
    state.featureRegistry.clear();
    resultLayerGroup.clearLayers();

    const items = layersResponse.items || [];
    items.forEach((layer) => {
      state.layers.set(layer.id, {
        ...layer,
        visible: true,
        geojson: null,
        leafletLayer: null,
        fields: [],
      });
    });

    refs.systemMode.textContent = `模式：${config.mode}`;
    refs.uploadCapability.textContent = config.gdalAvailable ? "GeoJSON / ZIP / GPKG" : "仅 GeoJSON 可用";
    refs.uploadHint.textContent = config.gdalAvailable
      ? "支持 GeoJSON、Shapefile ZIP、GeoPackage。"
      : "当前服务器未安装 GDAL，现阶段仅 GeoJSON 可导入。";
    refs.datasetStatus.textContent = `当前图层：${items.length} 个`;
    refs.activeLayerSelect.innerHTML = items
      .map((layer) => `<option value="${layer.id}">${layer.name}</option>`)
      .join("");

    state.activeLayerId = items.find((layer) => layer.id === preferredLayerId)?.id || items[0]?.id || null;
    refs.activeLayerSelect.value = state.activeLayerId || "";
    renderLayerList();

    for (const layer of items) {
      await ensureLayerLoaded(layer.id);
    }

    await refreshActiveLayerPanel();
    fitVisibleLayers();

    if (showReloadLog) {
      addLog(`图层刷新完成，共 ${items.length} 个图层。`);
    } else {
      addLog(`系统初始化完成，后端模式为 ${config.mode}。`);
    }
  } catch (error) {
    addLog(`初始化失败：${error.message}`, true);
    refs.systemMode.textContent = "模式：连接失败";
  }
}

async function resetDemoData() {
  try {
    const response = await apiPost("/api/demo/reset");
    if (response.ok) {
      addLog("示例库已重置。");
      await initializeData(true);
      return;
    }
  } catch (error) {
    addLog(`重置失败：${error.message}`, true);
    return;
  }
}

async function uploadLayer() {
  const file = refs.uploadFile.files?.[0];
  if (!file) {
    addLog("导入失败：请先选择文件。", true);
    return;
  }

  const formData = new FormData();
  formData.append("layerName", refs.uploadLayerName.value.trim());
  formData.append("layerDescription", refs.uploadLayerDescription.value.trim());
  formData.append("layerColor", refs.uploadLayerColor.value);
  formData.append("file", file);

  try {
    refs.uploadBtn.disabled = true;
    const response = await apiMultipart("/api/import/layer", formData);
    addLog(`导入完成：${response.layer.name} / ${response.layer.featureCount} 条要素。`);
    resetUploadForm();
    await initializeData(true, response.layer.id);
  } catch (error) {
    addLog(`导入失败：${error.message}`, true);
  } finally {
    refs.uploadBtn.disabled = false;
  }
}

function resetUploadForm() {
  refs.uploadLayerName.value = "";
  refs.uploadLayerDescription.value = "";
  refs.uploadLayerColor.value = "#3e8b85";
  refs.uploadFile.value = "";
}

async function ensureLayerLoaded(layerId) {
  const layer = state.layers.get(layerId);
  if (!layer) {
    return;
  }

  const geojson = await apiGet(`/api/layers/${layerId}/geojson`);
  const fieldsResponse = await apiGet(`/api/layers/${layerId}/fields`);

  layer.geojson = geojson;
  layer.fields = fieldsResponse.items || [];

  if (layer.leafletLayer) {
    map.removeLayer(layer.leafletLayer);
  }

  layer.leafletLayer = L.geoJSON(geojson, {
    style: (feature) => getFeatureStyle(layerId, feature),
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 8,
        ...getFeatureStyle(layerId, feature),
      }),
    onEachFeature: (feature, leafletLayer) => {
      const compoundId = buildCompoundId(layerId, feature.id);
      state.featureRegistry.set(compoundId, { layerId, feature, leafletLayer });
      leafletLayer.on("click", () => handleFeatureClick(layerId, feature.id));
      leafletLayer.bindPopup(renderPopup(layerId, feature), { className: "feature-popup" });
    },
  });

  if (layer.visible) {
    layer.leafletLayer.addTo(map);
  }
}

function renderLayerList() {
  const items = [...state.layers.values()];
  refs.layerList.innerHTML = items
    .map((layer) => {
      const checked = layer.visible ? "checked" : "";
      const activeClass = layer.id === state.activeLayerId ? "active" : "";
      return `
        <div class="layer-item ${activeClass}" data-layer-id="${layer.id}">
          <input type="checkbox" class="layer-toggle" data-layer-id="${layer.id}" ${checked} />
          <div class="layer-meta">
            <div class="layer-name">${layer.name}</div>
            <div class="layer-desc">${layer.description || ""} / ${layer.featureCount || 0} 条</div>
          </div>
          <div class="layer-actions">
            <button class="mini-btn focus-layer-btn" data-layer-id="${layer.id}">缩放</button>
            <button class="mini-btn activate-layer-btn" data-layer-id="${layer.id}">激活</button>
          </div>
        </div>
      `;
    })
    .join("");

  refs.layerList.querySelectorAll(".layer-toggle").forEach((element) => {
    element.addEventListener("change", (event) => {
      toggleLayerVisibility(event.target.dataset.layerId, event.target.checked);
    });
  });

  refs.layerList.querySelectorAll(".focus-layer-btn").forEach((element) => {
    element.addEventListener("click", () => zoomToLayer(element.dataset.layerId));
  });

  refs.layerList.querySelectorAll(".activate-layer-btn").forEach((element) => {
    element.addEventListener("click", async () => {
      state.activeLayerId = element.dataset.layerId;
      refs.activeLayerSelect.value = state.activeLayerId;
      renderLayerList();
      await refreshActiveLayerPanel();
    });
  });
}

function toggleLayerVisibility(layerId, visible) {
  const layer = state.layers.get(layerId);
  if (!layer || !layer.leafletLayer) {
    return;
  }

  layer.visible = visible;
  if (visible) {
    layer.leafletLayer.addTo(map);
  } else {
    map.removeLayer(layer.leafletLayer);
  }
  addLog(`${layer.name} 已${visible ? "显示" : "隐藏"}。`);
}

async function refreshActiveLayerPanel() {
  if (!state.activeLayerId) {
    refs.layerStats.textContent = "没有可用图层。";
    refs.themeFieldSelect.innerHTML = "";
    renderAttributesTable({ total: 0, items: [] });
    return;
  }

  // 清除属性表选中状态
  state.tableSelectedFeature = null;

  const [stats, attributes] = await Promise.all([
    apiGet(`/api/layers/${state.activeLayerId}/stats`),
    apiGet(`/api/layers/${state.activeLayerId}/attributes?q=${encodeURIComponent(state.attributeQuery)}&limit=50&offset=0`),
  ]);

  const layer = state.layers.get(state.activeLayerId);
  refs.layerStats.textContent = formatLayerStats(stats);
  refs.themeFieldSelect.innerHTML = (layer.fields || [])
    .map((field) => `<option value="${field.name}">${field.name} (${field.type})</option>`)
    .join("");
  renderAttributesTable(attributes);
  restyleAllFeatures();
}

function renderAttributesTable(payload) {
  const items = payload.items || [];
  refs.attributeSummary.textContent = `返回 ${items.length} / ${payload.total || 0} 条`;

  if (!items.length) {
    refs.attributeTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="empty-cell">没有匹配记录。</td>
      </tr>
    `;
    return;
  }

  refs.attributeTableBody.innerHTML = items
    .map((item) => {
      const compoundId = buildCompoundId(state.activeLayerId, item.featureId);
      const activeClass = isFeatureSelected(compoundId) ? "active-row" : "";
      return `
        <tr class="${activeClass}" data-feature-id="${item.featureId}">
          <td>${item.featureId}</td>
          <td>${item.geometryType}</td>
          <td>${escapeHtml(JSON.stringify(item.properties))}</td>
        </tr>
      `;
    })
    .join("");

  refs.attributeTableBody.querySelectorAll("tr[data-feature-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const featureId = row.dataset.featureId;
      handleTableRowClick(state.activeLayerId, featureId);
    });
  });
}

function formatLayerStats(stats) {
  const geometryBreakdown = Object.entries(stats.geometryBreakdown || {})
    .map(([type, count]) => `${type}: ${count}`)
    .join(" / ");
  const bbox = stats.bbox ? stats.bbox.map((value) => value.toFixed(3)).join(", ") : "无";
  const fieldList = (stats.fields || []).map((field) => `${field.name}(${field.type})`).join(", ");
  return [
    `要素数：${stats.featureCount || 0}`,
    `几何类型：${geometryBreakdown || "无"}`,
    `范围：${bbox}`,
    `字段：${fieldList || "无"}`,
  ].join("\n");
}

function applyTheme() {
  const layer = state.layers.get(state.activeLayerId);
  const field = refs.themeFieldSelect.value;
  if (!layer || !field || !layer.geojson?.features?.length) {
    addLog("专题图应用失败：当前图层或字段无效。", true);
    return;
  }

  const values = layer.geojson.features
    .map((feature) => feature.properties?.[field])
    .filter((value) => value !== null && value !== undefined);

  if (!values.length) {
    addLog("专题图应用失败：所选字段没有可用值。", true);
    return;
  }

  const numeric = values.every((value) => typeof value === "number");
  state.thematic.layerId = layer.id;
  state.thematic.field = field;

  if (numeric) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    state.thematic.type = "numeric";
    state.thematic.stops = [
      { label: `${min} - ${((min + max) / 2).toFixed(1)}`, color: "#fee8c8", min, max: (min + max) / 2 },
      { label: `${((min + max) / 2).toFixed(1)} - ${max}`, color: "#e34a33", min: (min + max) / 2, max },
    ];
  } else {
    const palette = ["#fee8c8", "#fdbb84", "#e34a33", "#74c69d", "#2a9d8f", "#264653"];
    const categories = [...new Set(values.map((value) => String(value)))];
    state.thematic.type = "category";
    state.thematic.stops = categories.map((value, index) => ({
      label: value,
      color: palette[index % palette.length],
      value,
    }));
  }

  refs.themeLegend.innerHTML = state.thematic.stops
    .map((stop) => `<div><i class="swatch" style="background:${stop.color}"></i>${stop.label}</div>`)
    .join("");

  restyleAllFeatures();
  addLog(`已应用专题图：${layer.name} / 字段 ${field}。`);
}

function clearTheme() {
  state.thematic = { layerId: null, field: "", type: null, stops: [] };
  refs.themeLegend.textContent = "未应用专题图。";
  restyleAllFeatures();
  addLog("专题图已清除。");
}

function renderAttributesTableFromCurrentSelection() {
  const rows = refs.attributeTableBody.querySelectorAll("tr[data-feature-id]");
  rows.forEach((row) => {
    const compoundId = buildCompoundId(state.activeLayerId, row.dataset.featureId);
    // 检查是否是属性表当前选中行或选择槽选中
    const isTableSelected = state.tableSelectedFeature === compoundId;
    const isSlotSelected = isFeatureSelected(compoundId);
    row.classList.toggle("active-row", isTableSelected || isSlotSelected);
  });
}

function handleTableRowClick(layerId, featureId) {
  const compoundId = buildCompoundId(layerId, featureId);
  
  // 如果重复点击同一行，取消选中
  if (state.tableSelectedFeature === compoundId) {
    state.tableSelectedFeature = null;
    renderAttributesTableFromCurrentSelection();
    restyleAllFeatures();
    return;
  }
  
  // 清除之前的选中，设置新的选中
  state.tableSelectedFeature = compoundId;
  renderAttributesTableFromCurrentSelection();
  
  // 高亮闪烁地图上的要素
  const registryItem = state.featureRegistry.get(compoundId);
  if (registryItem) {
    highlightSingleFeatureWithFlash(registryItem.leafletLayer, layerId, registryItem.feature);
    
    // 平移到该要素
    if (typeof registryItem.leafletLayer.getBounds === "function") {
      const bounds = registryItem.leafletLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.6));
      } else if (registryItem.leafletLayer.getLatLng) {
        map.panTo(registryItem.leafletLayer.getLatLng());
      }
    } else if (registryItem.leafletLayer.getLatLng) {
      map.panTo(registryItem.leafletLayer.getLatLng());
    }
  }
}

function highlightSingleFeatureWithFlash(leafletLayer, layerId, feature) {
  const duration = 2500; // 闪烁持续时间（毫秒）
  const flashCount = 5; // 闪烁次数
  const interval = duration / flashCount;
  let flashIndex = 0;

  const flashInterval = setInterval(() => {
    flashIndex++;
    const isVisible = flashIndex % 2 === 1;
    
    if (isVisible) {
      // 高亮状态
      leafletLayer.setStyle({
        weight: 6,
        opacity: 1,
        fillOpacity: 0.75,
        color: "#f09e4b",
      });
    } else {
      // 恢复原样式
      const originalStyle = getFeatureStyle(layerId, feature);
      leafletLayer.setStyle(originalStyle);
    }

    if (flashIndex >= flashCount) {
      clearInterval(flashInterval);
      // 最后保持高亮显示（粗边线）
      leafletLayer.setStyle({
        weight: 4,
        color: "#f09e4b",
        opacity: 0.95,
        fillOpacity: feature.geometry.type.includes("Polygon") ? 0.45 : 0.88,
      });
    }
  }, interval);
}

function handleFeatureClick(layerId, featureId, panToFeature = false) {
  const compoundId = buildCompoundId(layerId, featureId);
  const targetSlot = refs.selectionTarget.value;
  state.selection[targetSlot] = compoundId;
  updateSelectionCards();
  restyleAllFeatures();
  renderAttributesTableFromCurrentSelection();

  const registryItem = state.featureRegistry.get(compoundId);
  if (registryItem && panToFeature) {
    if (typeof registryItem.leafletLayer.getBounds === "function") {
      const bounds = registryItem.leafletLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.6));
      } else if (registryItem.leafletLayer.getLatLng) {
        map.panTo(registryItem.leafletLayer.getLatLng());
      }
    } else if (registryItem.leafletLayer.getLatLng) {
      map.panTo(registryItem.leafletLayer.getLatLng());
    }
  }

  addLog(`已将 ${featureLabel(registryItem.feature)} 绑定到对象 ${targetSlot.toUpperCase()}。`);
}

function renderAttributesTableFromCurrentSelection() {
  const rows = refs.attributeTableBody.querySelectorAll("tr[data-feature-id]");
  rows.forEach((row) => {
    const compoundId = buildCompoundId(state.activeLayerId, row.dataset.featureId);
    row.classList.toggle("active-row", isFeatureSelected(compoundId));
  });
}

function updateSelectionCards() {
  refs.selectionA.textContent = renderSelectionText("a");
  refs.selectionB.textContent = renderSelectionText("b");
}

function renderSelectionText(slot) {
  const compoundId = state.selection[slot];
  const item = compoundId ? state.featureRegistry.get(compoundId) : null;
  if (!item) {
    return "未选择";
  }

  const metrics = summarizeFeature(item.feature);
  const layerName = state.layers.get(item.layerId)?.name || item.layerId;
  return `${layerName}\n${featureLabel(item.feature)}\n${geometryTypeLabel(item.feature.geometry.type)}\n${metrics}`;
}

function summarizeFeature(feature) {
  const geometry = feature.geometry || {};
  if (geometry.type.includes("Polygon")) {
    return `面积：${formatSquareMeters(turf.area(feature))}`;
  }
  if (geometry.type.includes("LineString")) {
    return `长度：${turf.length(feature, { units: "kilometers" }).toFixed(2)} km`;
  }
  if (geometry.type === "Point") {
    return `坐标：${geometry.coordinates[0].toFixed(4)}, ${geometry.coordinates[1].toFixed(4)}`;
  }
  return "无摘要";
}

function runBufferAnalysis() {
  const feature = getSelectedFeature("a");
  if (!feature) {
    addLog("缓冲区分析失败：请先选择对象 A。", true);
    return;
  }

  const radiusMeters = Number(refs.bufferRadius.value);
  if (!radiusMeters || radiusMeters <= 0) {
    addLog("缓冲区分析失败：请输入有效半径。", true);
    return;
  }

  resultLayerGroup.clearLayers();
  const buffer = turf.buffer(feature, radiusMeters / 1000, { units: "kilometers" });
  resultLayerGroup.addData(buffer);
  fitResultOrVisible();
  addLog(`缓冲区分析完成：半径 ${radiusMeters} m，面积 ${formatSquareMeters(turf.area(buffer))}。`);
}

function runIntersectionAnalysis() {
  const featureA = getSelectedFeature("a");
  const featureB = getSelectedFeature("b");
  if (!featureA || !featureB) {
    addLog("相交分析失败：请先选择对象 A 和 B。", true);
    return;
  }

  resultLayerGroup.clearLayers();
  const intersects = turf.booleanIntersects(featureA, featureB);
  if (!intersects) {
    addLog("A / B 不相交。");
    return;
  }

  const polygonTypes = ["Polygon", "MultiPolygon"];
  if (polygonTypes.includes(featureA.geometry.type) && polygonTypes.includes(featureB.geometry.type)) {
    try {
      const intersection = turf.intersect(turf.featureCollection([featureA, featureB]));
      if (intersection) {
        resultLayerGroup.addData(intersection);
        fitResultOrVisible();
        addLog(`A / B 相交面积：${formatSquareMeters(turf.area(intersection))}。`);
        return;
      }
    } catch (error) {
      addLog(`相交面提取失败：${error.message}`, true);
      return;
    }
  }

  addLog("A / B 存在空间相交关系。");
}

function runPointInPolygonAnalysis() {
  const featureA = getSelectedFeature("a");
  const featureB = getSelectedFeature("b");
  if (!featureA || !featureB) {
    addLog("点落区分析失败：请先选择对象 A 和 B。", true);
    return;
  }

  const pair =
    featureA.geometry.type === "Point" && featureB.geometry.type.includes("Polygon")
      ? { point: featureA, polygon: featureB, pointSlot: "A", polygonSlot: "B" }
      : featureB.geometry.type === "Point" && featureA.geometry.type.includes("Polygon")
        ? { point: featureB, polygon: featureA, pointSlot: "B", polygonSlot: "A" }
        : null;

  if (!pair) {
    addLog("点落区分析失败：需要一个点要素和一个面要素。", true);
    return;
  }

  const isInside = turf.booleanPointInPolygon(pair.point, pair.polygon);
  addLog(`点落区分析：对象 ${pair.pointSlot} ${isInside ? "位于" : "不位于"} 对象 ${pair.polygonSlot} 内部。`);
}

function getSelectedFeature(slot) {
  const compoundId = state.selection[slot];
  return compoundId ? state.featureRegistry.get(compoundId)?.feature || null : null;
}

function zoomToLayer(layerId) {
  const layer = state.layers.get(layerId);
  if (!layer?.leafletLayer) {
    return;
  }

  const bounds = layer.leafletLayer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.2));
  }
}

function fitVisibleLayers() {
  const bounds = L.latLngBounds([]);
  state.layers.forEach((layer) => {
    if (layer.visible && layer.leafletLayer) {
      const layerBounds = layer.leafletLayer.getBounds();
      if (layerBounds.isValid()) {
        bounds.extend(layerBounds);
      }
    }
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.2));
  }
}

function fitResultOrVisible() {
  const bounds = resultLayerGroup.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.2));
    return;
  }
  fitVisibleLayers();
}

function restyleAllFeatures() {
  state.layers.forEach((layer) => {
    if (!layer.leafletLayer) {
      return;
    }
    layer.leafletLayer.eachLayer((leafletLayer) => {
      const feature = leafletLayer.feature;
      if (!feature) {
        return;
      }
      leafletLayer.setStyle(getFeatureStyle(layer.id, feature));
    });
  });
}

function highlightLayerWithFlash(layerId) {
  const layer = state.layers.get(layerId);
  if (!layer || !layer.leafletLayer) {
    return;
  }

  const duration = 3000; // 闪烁持续时间（毫秒）
  const flashCount = 6; // 闪烁次数
  const interval = duration / flashCount;
  let flashIndex = 0;

  const originalStyles = new Map();
  layer.leafletLayer.eachLayer((leafletLayer) => {
    originalStyles.set(leafletLayer, leafletLayer.options);
  });

  const flashInterval = setInterval(() => {
    flashIndex++;
    const isVisible = flashIndex % 2 === 1;
    
    layer.leafletLayer.eachLayer((leafletLayer) => {
      if (isVisible) {
        // 高亮状态：增加透明度和边界粗细
        leafletLayer.setStyle({
          weight: 5,
          opacity: 1,
          fillOpacity: 0.65,
          color: "#f09e4b",
        });
      } else {
        // 恢复原样式
        const originalStyle = getFeatureStyle(layerId, leafletLayer.feature);
        leafletLayer.setStyle(originalStyle);
      }
    });

    if (flashIndex >= flashCount) {
      clearInterval(flashInterval);
      // 最后恢复正常样式
      layer.leafletLayer.eachLayer((leafletLayer) => {
        const feature = leafletLayer.feature;
        if (feature) {
          leafletLayer.setStyle(getFeatureStyle(layerId, feature));
        }
      });
    }
  }, interval);
}

function getFeatureStyle(layerId, feature) {
  const layer = state.layers.get(layerId);
  const compoundId = buildCompoundId(layerId, feature.id);
  const selectedA = state.selection.a === compoundId;
  const selectedB = state.selection.b === compoundId;
  const isTableSelected = state.tableSelectedFeature === compoundId;

  const baseColor = getThemeColor(layerId, feature) || layer?.color || "#3e8b85";
  
  // 优先使用表格选中状态
  if (isTableSelected) {
    return {
      color: "#f09e4b",
      fillColor: baseColor,
      weight: 4,
      opacity: 0.95,
      fillOpacity: feature.geometry.type.includes("Polygon") ? 0.45 : 0.88,
    };
  }
  
  const strokeColor = selectedA ? "#f09e4b" : selectedB ? "#74c69d" : baseColor;
  const weight = selectedA || selectedB ? 4 : 2;

  return {
    color: strokeColor,
    fillColor: baseColor,
    weight,
    opacity: 0.95,
    fillOpacity: feature.geometry.type.includes("Polygon") ? 0.36 : 0.88,
  };
}

function getThemeColor(layerId, feature) {
  if (state.thematic.layerId !== layerId || !state.thematic.field || !state.thematic.type) {
    return null;
  }

  const value = feature.properties?.[state.thematic.field];
  if (value === null || value === undefined) {
    return "#d9d9d9";
  }

  if (state.thematic.type === "numeric") {
    const stop = state.thematic.stops.find((item) => Number(value) >= item.min && Number(value) <= item.max);
    return stop?.color || "#e34a33";
  }

  const stop = state.thematic.stops.find((item) => item.value === String(value));
  return stop?.color || "#2a9d8f";
}

function renderPopup(layerId, feature) {
  const layerName = state.layers.get(layerId)?.name || layerId;
  return `
    <strong>${layerName}</strong><br />
    ${featureLabel(feature)}<br />
    类型：${geometryTypeLabel(feature.geometry.type)}<br />
    属性：${escapeHtml(JSON.stringify(feature.properties || {}))}
  `;
}

function buildCompoundId(layerId, featureId) {
  return `${layerId}::${featureId}`;
}

function isFeatureSelected(compoundId) {
  return state.selection.a === compoundId || state.selection.b === compoundId;
}

function featureLabel(feature) {
  return feature.properties?.name || feature.id || "未命名要素";
}

function geometryTypeLabel(type) {
  const mapping = {
    Point: "点",
    MultiPoint: "多点",
    LineString: "线",
    MultiLineString: "多线",
    Polygon: "面",
    MultiPolygon: "多面",
  };
  return mapping[type] || type;
}

function formatSquareMeters(area) {
  if (area >= 1000000) {
    return `${(area / 1000000).toFixed(2)} km2`;
  }
  return `${area.toFixed(0)} m2`;
}

function addLog(message, isError = false) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })} ${message}`;
  if (isError) {
    item.style.color = "#ffb4b4";
  }
  refs.resultLog.prepend(item);
}

async function apiGet(pathname) {
  const response = await fetch(pathname);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

async function apiPost(pathname, payload = {}) {
  const response = await fetch(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

async function apiMultipart(pathname, formData) {
  const response = await fetch(pathname, {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
