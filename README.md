# GeoScope Spatial Lab

一个可运行的 GIS 空间分析系统骨架，当前已经包含：

- Node 后端 API
- 默认可跑的 memory 模式
- 可切换的 PostGIS 适配层
- 图层管理、属性查询、属性表
- 专题图渲染
- 基础空间分析
- 地图搜索与状态显示
- 响应式 UI 布局

## 目录说明

- `server.js`: 静态资源与 API 服务入口
- `data/memory-adapter.js`: 默认演示数据源
- `data/postgis-adapter.js`: PostGIS 查询适配器
- `db/init.sql`: PostGIS 初始化脚本
- `app.js`: 前端 GIS 工作台逻辑
- `services/import-service.js`: 上传解析与导入服务

## 默认启动

不依赖数据库，直接运行：

```bash
cd /home/chan/projects/GIS
node server.js
```

打开：

```text
http://localhost:3000
```

## PostGIS 模式

1. 安装依赖：

```bash
npm install
```

2. 初始化数据库：

```sql
\i /home/chan/projects/GIS/db/init.sql
```

3. 配置环境变量：

```bash
export GIS_DATA_MODE=postgis
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/geoscope
```

4. 启动服务：

```bash
node server.js
```

## 已实现接口

- `GET /api/config`
- `GET /api/health`
- `GET /api/layers`
- `GET /api/layers/:id`
- `GET /api/layers/:id/geojson`
- `GET /api/layers/:id/fields`
- `GET /api/layers/:id/attributes?q=&limit=&offset=`
- `GET /api/layers/:id/stats`
- `POST /api/import/layer`
- `POST /api/demo/reset`

## 当前前端能力

- 图层上传入库
- 图层显示、隐藏、缩放、激活
- 当前图层属性模糊查询
- 属性表联动地图高亮
- 按字符串字段分类专题图
- 按数值字段分级专题图
- 缓冲区、相交、点落区分析
- 地图搜索功能（按属性值搜索要素）
- 地图状态栏（显示当前视图范围和缩放级别）
- 响应式布局（大屏左右布局，小屏上下布局）
- 地图缩放限制解除（支持全球视图）

## 导入格式

- `.geojson` / `.json`: 直接导入，当前环境可用
- `.zip`: 预期为 Shapefile 压缩包，依赖 `ogr2ogr`
- `.gpkg`: GeoPackage，依赖 `ogr2ogr`

如果服务器没有安装 GDAL，系统会明确提示只能导入 GeoJSON。

## 安装 GDAL

Ubuntu 24.04 可直接执行：

```bash
sudo apt-get update
sudo apt-get install -y gdal-bin
```

## 项目链接

- GitHub: https://github.com/dmuchan/geoscope
```

安装完成后验证：

```bash
ogr2ogr --version
```

然后重启服务：

```bash
cd /home/chan/projects/GIS
node server.js
```

服务启动后访问 `GET /api/config`，应看到：

```json
{
  "gdalAvailable": true
}
```

这时前端上传面板就会从“仅 GeoJSON 可用”切换成 “GeoJSON / ZIP / GPKG”。

## 下一步建议

你如果继续往正式生产系统推，下一批我建议直接做：

- 图层上传入库流程，支持 Shapefile / GeoPackage
- 用户、项目、权限和任务流
- 导出分析结果为 GeoJSON / Excel / PNG
- 接 GeoServer 发布 WMS / WFS 服务
