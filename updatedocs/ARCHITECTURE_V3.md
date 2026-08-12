# Geomap v3 架构

## 原则

v3 采用渐进迁移：现有 Leaflet UI 继续工作，新业务能力进入 TypeScript 核心；每一步都保持 Pages、Full/Lite URL、GeoJSON 字段和单文件预载契约兼容。

## 模块边界

- `config.ts`：解析 Full/Lite 和统一能力配置。
- `types.ts`：公开数据、工作区、导入结果与地图适配器接口。
- `store/feature-store.ts`：与 Leaflet 无关的唯一业务状态容器。
- `io/geojson.ts`：不可信 GeoJSON 的校验、规范化和 Full/Lite 边界。
- `storage/workspace-storage.ts`：版本化工作区、旧 localStorage 只读迁移和备份。
- `security.ts`：HTML/URL 净化与 CSV/Excel 公式注入防护。
- `map/map-adapter.ts`：Leaflet 与状态层之间的适配边界。

## 兼容契约

- `?variant=lite` 优先于发行默认值。
- `window.__PRELOADED_DATA__` 与 `window.__PRELOADED_META__` 继续支持。
- 旧存储键不会在首次迁移时删除；v3 数据写入 `geomap.workspace.v1`。
- `window.GeomapCore` 是迁移期只读门面，新模块不得增加其他全局业务状态。

## 构建

`npm run prepare:vendor` 从锁定依赖生成 `public/vendor/`。Pages 构建由 Vite 完成；单文件构建在 Pages 产物基础上内嵌脚本、CSS、字体和图片。在线瓦片不是应用资产，断网时由 CSS 网格底图替代。

## 后续迁移顺序

图层/导入导出 → 属性编辑器 → 分组与快照 → 表格与看板 → 清理最后的内联事件和兼容全局。每次迁移必须先增加浏览器回归用例，再切换实现。
