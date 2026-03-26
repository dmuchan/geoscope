const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");
const { URL } = require("url");

const MemoryAdapter = require("./data/memory-adapter");
const PostGISAdapter = require("./data/postgis-adapter");
const { ImportService, readMultipartRequest } = require("./services/import-service");

const PORT = Number(process.env.PORT || 3000);
const GIS_DATA_MODE = process.env.GIS_DATA_MODE || "memory";
const DATABASE_URL = process.env.DATABASE_URL || "";
const GDAL_AVAILABLE = spawnSync("ogr2ogr", ["--version"], { stdio: "ignore" }).status === 0;

const adapter =
  GIS_DATA_MODE === "postgis" || DATABASE_URL
    ? new PostGISAdapter({ databaseUrl: DATABASE_URL })
    : new MemoryAdapter();
const importService = new ImportService({ adapter, gdalAvailable: GDAL_AVAILABLE });

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(req, res, requestUrl);
      return;
    }

    await serveStatic(req, res, requestUrl.pathname);
  } catch (error) {
    sendJson(res, 500, {
      error: "internal_error",
      message: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`GeoScope server listening on http://localhost:${PORT} (${adapter.mode})`);
});

async function handleApi(req, res, requestUrl) {
  const pathname = requestUrl.pathname;

  if (pathname === "/api/health" && req.method === "GET") {
    const health = await adapter.health();
    sendJson(res, 200, health);
    return;
  }

  if (pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, {
      mode: adapter.mode,
      postgisEnabled: adapter.mode === "postgis",
      gdalAvailable: GDAL_AVAILABLE,
      supportedUploadFormats: importService.getSupportedFormats(),
    });
    return;
  }

  if (pathname === "/api/import/layer" && req.method === "POST") {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      sendJson(res, 400, { message: "上传接口只接受 multipart/form-data。" });
      return;
    }

    const payload = await readMultipartRequest(req);
    const layer = await importService.importLayerUpload(payload);
    sendJson(res, 201, { ok: true, layer });
    return;
  }

  if (pathname === "/api/demo/reset" && req.method === "POST") {
    if (adapter.mode !== "memory") {
      sendJson(res, 400, { message: "只有 memory 模式支持重置示例数据。" });
      return;
    }

    adapter.resetDemo();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/layers" && req.method === "GET") {
    const layers = await adapter.listLayers();
    sendJson(res, 200, { items: layers });
    return;
  }

  const layerMatch = pathname.match(/^\/api\/layers\/([^/]+)$/);
  if (layerMatch && req.method === "GET") {
    const layer = await adapter.getLayer(layerMatch[1]);
    if (!layer) {
      sendJson(res, 404, { message: "图层不存在。" });
      return;
    }
    sendJson(res, 200, layer);
    return;
  }

  const geojsonMatch = pathname.match(/^\/api\/layers\/([^/]+)\/geojson$/);
  if (geojsonMatch && req.method === "GET") {
    const geojson = await adapter.getLayerGeoJSON(geojsonMatch[1], requestUrl.searchParams.get("q") || "");
    if (!geojson) {
      sendJson(res, 404, { message: "图层不存在。" });
      return;
    }
    sendJson(res, 200, geojson);
    return;
  }

  const fieldsMatch = pathname.match(/^\/api\/layers\/([^/]+)\/fields$/);
  if (fieldsMatch && req.method === "GET") {
    const fields = await adapter.getLayerFields(fieldsMatch[1]);
    if (!fields) {
      sendJson(res, 404, { message: "图层不存在。" });
      return;
    }
    sendJson(res, 200, { items: fields });
    return;
  }

  const attributesMatch = pathname.match(/^\/api\/layers\/([^/]+)\/attributes$/);
  if (attributesMatch && req.method === "GET") {
    const attributes = await adapter.getLayerAttributes(attributesMatch[1], {
      query: requestUrl.searchParams.get("q") || "",
      limit: requestUrl.searchParams.get("limit") || "20",
      offset: requestUrl.searchParams.get("offset") || "0",
    });
    if (!attributes) {
      sendJson(res, 404, { message: "图层不存在。" });
      return;
    }
    sendJson(res, 200, attributes);
    return;
  }

  const statsMatch = pathname.match(/^\/api\/layers\/([^/]+)\/stats$/);
  if (statsMatch && req.method === "GET") {
    const stats = await adapter.getLayerStats(statsMatch[1]);
    if (!stats) {
      sendJson(res, 404, { message: "图层不存在。" });
      return;
    }
    sendJson(res, 200, stats);
    return;
  }

  sendJson(res, 404, { message: "接口不存在。" });
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const normalizedPath = path.normalize(safePath);
  const filePath = path.resolve(__dirname, normalizedPath);
  const workspacePrefix = `${__dirname}${path.sep}`;

  if (filePath !== __dirname && !filePath.startsWith(workspacePrefix)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const extension = path.extname(filePath);
  if (!MIME_TYPES[extension]) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  let content;
  try {
    content = await fs.promises.readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    throw error;
  }
  res.writeHead(200, { "Content-Type": MIME_TYPES[extension] });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(content);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
