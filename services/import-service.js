const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const { normalizeGeoJSON } = require("../data/utils");

const execFileAsync = promisify(execFile);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

class ImportService {
  constructor({ adapter, gdalAvailable }) {
    this.adapter = adapter;
    this.gdalAvailable = gdalAvailable;
  }

  getSupportedFormats() {
    return [".geojson", ".json", ".zip", ".gpkg"];
  }

  async importLayerUpload({ file, fields }) {
    if (!file) {
      throw new Error("缺少上传文件。");
    }

    const layerName = String(fields.layerName || deriveLayerName(file.filename)).trim();
    const layerDescription = String(fields.layerDescription || "").trim();
    const layerColor = normalizeLayerColor(fields.layerColor);

    const imported = await this.parseUploadFile(file);
    return this.adapter.importLayer({
      layerName,
      layerDescription,
      layerColor,
      source: `upload:${imported.format}`,
      originalFilename: file.filename,
      geojson: imported.geojson,
    });
  }

  async parseUploadFile(file) {
    const extension = path.extname(file.filename || "").toLowerCase();
    if (extension === ".geojson" || extension === ".json") {
      return {
        format: "geojson",
        geojson: parseGeoJSONBuffer(file.content),
      };
    }

    if (extension === ".zip") {
      const geojson = await this.convertArchiveWithGdal(file.content, file.filename, "zip");
      return { format: "shapefile", geojson };
    }

    if (extension === ".gpkg") {
      const geojson = await this.convertArchiveWithGdal(file.content, file.filename, "gpkg");
      return { format: "gpkg", geojson };
    }

    throw new Error("仅支持 .geojson/.json、.zip(Shapefile) 和 .gpkg 文件。");
  }

  async convertArchiveWithGdal(buffer, filename, type) {
    if (!this.gdalAvailable) {
      throw new Error("当前服务器未安装 GDAL/ogr2ogr，暂时只能导入 GeoJSON。");
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "geoscope-import-"));

    try {
      const sourcePath = path.join(tempDir, filename);
      const outputPath = path.join(tempDir, "converted.geojson");
      await fs.promises.writeFile(sourcePath, buffer);

      let inputPath = sourcePath;
      if (type === "zip") {
        const extractedDir = path.join(tempDir, "unzipped");
        await fs.promises.mkdir(extractedDir, { recursive: true });
        await execFileAsync("unzip", ["-q", sourcePath, "-d", extractedDir]);
        const shapefilePath = await findFirstFileByExtension(extractedDir, ".shp");
        if (!shapefilePath) {
          throw new Error("ZIP 中未找到 .shp 文件。");
        }
        inputPath = shapefilePath;
      }

      await execFileAsync("ogr2ogr", ["-f", "GeoJSON", outputPath, inputPath]);
      const text = await fs.promises.readFile(outputPath, "utf8");
      return parseGeoJSONBuffer(Buffer.from(text, "utf8"));
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  }
}

async function readMultipartRequest(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error("上传请求缺少 multipart boundary。");
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_UPLOAD_BYTES) {
      throw new Error("上传文件超过 50MB 限制。");
    }
    chunks.push(chunk);
  }

  return parseMultipartBuffer(Buffer.concat(chunks), boundaryMatch[1] || boundaryMatch[2]);
}

function parseMultipartBuffer(buffer, boundary) {
  const raw = buffer.toString("latin1");
  const boundaryMarker = `--${boundary}`;
  const fields = {};
  let file = null;
  let cursor = 0;

  while (true) {
    const boundaryIndex = raw.indexOf(boundaryMarker, cursor);
    if (boundaryIndex === -1) {
      break;
    }

    let partStart = boundaryIndex + boundaryMarker.length;
    if (raw.slice(partStart, partStart + 2) === "--") {
      break;
    }
    if (raw.slice(partStart, partStart + 2) === "\r\n") {
      partStart += 2;
    }

    const headerEnd = raw.indexOf("\r\n\r\n", partStart);
    if (headerEnd === -1) {
      break;
    }

    const headerText = raw.slice(partStart, headerEnd);
    const contentStart = headerEnd + 4;
    const nextBoundaryIndex = raw.indexOf(`\r\n${boundaryMarker}`, contentStart);
    if (nextBoundaryIndex === -1) {
      break;
    }

    const content = buffer.slice(contentStart, nextBoundaryIndex);
    const headers = parsePartHeaders(headerText);
    const disposition = headers["content-disposition"] || "";
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    const filenameMatch = disposition.match(/filename="([^"]*)"/i);
    const fieldName = nameMatch?.[1];

    if (fieldName) {
      if (filenameMatch && filenameMatch[1]) {
        file = {
          fieldName,
          filename: path.basename(filenameMatch[1]),
          contentType: headers["content-type"] || "application/octet-stream",
          content,
        };
      } else {
        fields[fieldName] = content.toString("utf8");
      }
    }

    cursor = nextBoundaryIndex + 2;
  }

  return { fields, file };
}

function parsePartHeaders(headerText) {
  return headerText.split("\r\n").reduce((accumulator, line) => {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      return accumulator;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    accumulator[key] = value;
    return accumulator;
  }, {});
}

function parseGeoJSONBuffer(buffer) {
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error(`GeoJSON 解析失败：${error.message}`);
  }

  return normalizeGeoJSON(parsed);
}

async function findFirstFileByExtension(rootDir, extension) {
  const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFirstFileByExtension(fullPath, extension);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === extension) {
      return fullPath;
    }
  }

  return null;
}

function deriveLayerName(filename) {
  return path.basename(filename, path.extname(filename));
}

function normalizeLayerColor(value) {
  const input = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(input)) {
    return input;
  }
  return "#3e8b85";
}

module.exports = {
  ImportService,
  readMultipartRequest,
};
