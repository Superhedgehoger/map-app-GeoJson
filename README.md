# GeoJSON 地图编辑器

[![Version](https://img.shields.io/badge/version-v2.13.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/github-Geomap--app-181717.svg?logo=github)](https://github.com/Superhedgehoger/Geomap-app)

> ⚠️ **隐私声明**：本项目不包含任何真实或测试业务数据，仅提供代码结构与功能实现。

一个功能完整的 **专业级 GeoJSON 地图编辑器**，类似 [geojson.io](https://geojson.io)，基于 Leaflet 构建，支持高级图层管理、时间轴快照、组合标记、框选操作等企业级功能。

---

## ✨ 核心功能

### 🎨 绘图与编辑
- **绘图工具** - 标记、折线、多边形、矩形、圆形（Leaflet.draw）
- **图标自定义** - 30+ Font Awesome 图标 + 颜色选择器
- **属性编辑器** - 侧边栏实时编辑标记属性（名称、类型、备注等）
- **样式编辑** - 颜色、透明度、线宽可视化调节

### 📂 图层管理
- **文件夹组织** - 自定义组显示为可折叠文件夹
- **显隐控制** - 眼睛图标切换，隐藏图层半透明 + 删除线
- **批量操作** - 框选、多选、分组管理
- **搜索过滤** - 快速定位图层

### 📸 时间轴快照
- **状态保存** - 保存地图状态（图层、样式、视图）
- **快照管理** - 重命名、删除、**复制**快照
- **浏览模式** - 只读浏览历史状态，防止误操作
- **时间线切换** - 点击快照即可切换不同时间点

### 🎯 专业级选择工具
- **Shift + 拖动框选** - 绘制矩形选区，自动选中范围内标记
- **Ctrl + 单击多选** - 快速添加/移除单个标记
- **ESC 快捷退出** - 一键清空选中并退出选择模式
- **视觉反馈** - 蓝色虚线选区 + 高亮标记 + 实时计数

### 🗺️ 数据导入导出
- **GeoJSON 导入/导出** - 完整格式支持（FeatureCollection）
- **Excel 导入/导出** - 支持 `.xlsx`，包含所有字段与坐标
- **批量导入** - 支持同坐标多标记（自动合并为组）
- **CSV 支持** - 坐标批量导入

### 📊 数据视图
- **表格视图** - Tabulator 集成，虚拟滚动，5000+ 行流畅渲染
- **单元格编辑** - 双击编辑，实时同步到地图
- **四向联动** - 表格 ↔ 地图 ↔ 图层面板 ↔ 属性编辑器同步选中
- **统计看板** - 实时显示标记数量、类型分布、自定义组统计

### 🔗 组合标记
- **自动合并** - 同一坐标多个标记自动合并为组标记
- **Spiderfy 展开** - 点击组标记，子标记放射状展开
- **独立编辑** - 展开后可独立编辑/删除每个子标记
- **徽章显示** - 组标记显示数量徽章（如 `[5]`）

### 🎨 视觉增强
- **点聚合** - Leaflet.markercluster，大数据量性能优化
- **底图切换** - OSM、卫星影像、暗色/亮色主题、高德地图等
- **标注显示** - 可选显示/隐藏标记名称
- **响应式设计** - 适配桌面端与大屏显示

---

## 🚀 快速开始

### 在线体验
访问 GitHub Pages 部署版本：  
🔗 **[https://superhedgehoger.github.io/Geomap-app/](https://superhedgehoger.github.io/Geomap-app/)**

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/Superhedgehoger/Geomap-app.git
cd Geomap-app

# 启动本地服务器（任选一种）
python server.py           # 推荐
# 或
python -m http.server 8000
```

浏览器访问：`http://localhost:8000`

---

## 📁 项目结构

```
Geomap-app/
├── index.html                  # 主入口
├── script.js                   # 核心逻辑（绘图、导入导出、图层管理）
├── style.css                   # 样式
├── timeline-manager.js         # 时间轴快照模块
├── custom-group-manager.js     # 自定义组管理（文件夹 + 框选）
├── table-view.js               # 表格视图模块
├── marker-group.js             # 组合标记模块（Spiderfy）
├── selection-manager.js        # 选中状态管理
├── property-editor.js          # 属性编辑器
├── layer-stats.js              # 统计看板
├── dashboard-panel.js          # 仪表盘
├── server.py                   # 本地 HTTP 服务器
└── updatedocs/                 # 开发文档
    ├── PRODUCT_PLAN_P0.md      # 产品规划与 P0 优先级
    ├── API_REFERENCE.md        # API 参考
    ├── DEVELOPER_GUIDE.md      # 开发指南
    └── DOC_WORKFLOW.md         # 文档维护规则
```

---

## 📖 使用指南

### 基本操作

#### 1. 添加标记
- 点击左侧工具栏的 **📍 标记工具**
- 在地图上点击添加标记
- 右键编辑属性（名称、类型、备注等）

#### 2. 导入数据
**Excel 导入** (推荐批量导入)：
```excel
| 名称     | 经度      | 维度     | 类型 |
|----------|-----------|----------|------|
| 北京银行 | 116.4074  | 39.9042  | 银行 |
| 星巴克   | 116.4074  | 39.9042  | 餐饮 |
```
→ 左侧面板 → **导入** → 上传 Excel → 自动生成标记

**GeoJSON 导入**：
→ 左侧面板 → **导入** → 拖拽 `.geojson` 文件

#### 3. 图层分组
- 进入选择模式：图层面板 → **📦 自定义组** → **选择标记创建组**
- 框选标记：按住 **Shift** 拖动鼠标绘制选区
- 完成创建：点击提示条的 **"完成创建"** 按钮 → 输入组名
- 图层列表自动显示文件夹结构

#### 4. 时间轴快照
- 保存当前状态：**⏱️ 时间轴** → **保存快照** → 输入名称
- 浏览历史：点击快照条目 → 进入浏览模式
- 应用快照：浏览模式下点击 **"应用"** → 覆盖当前编辑
- 退出浏览：按 **ESC** 或点击 **"取消"**

---

## 🎯 高级功能

### 专业级框选工具
1. 开启选择模式：**📦 自定义组** → **选择标记创建组**
2. 操作方式：
   - **单击** = 单选（清空其他选中）
   - **Ctrl + 单击** = 多选/取消选中
   - **Shift + 拖动** = 矩形框选
   - **ESC** = 退出选择模式
3. 创建组：选中标记后点击 **"完成创建"** → 输入组名

### 同坐标多标记管理
当多个标记坐标完全相同时：
- 自动合并为组标记（显示 `[N]` 徽章）
- 点击组标记 → 子标记放射状展开（Spiderfy）
- 展开后可独立编辑、删除每个子标记
- 点击地图空白处或按 **ESC** 收起

**添加方法**：
- Excel 导入：同一坐标写多行
- 属性表编辑：手动修改坐标为完全相同值

详见文档：[同坐标多标记指南](https://github.com/Superhedgehoger/Geomap-app/blob/main/同坐标多标记指南.md)

---

## 📦 分发版本

### Lite 版本
轻量级版本，专注核心地图编辑功能（不含事件追踪器）：  
🔗 **[Geomap-app-lite](https://github.com/Superhedgehoger/Geomap-app-lite)**

### 单网页版
所有 JS/CSS 内联到一个 HTML 文件，适用于：
- 快速分享演示
- 嵌入其他系统
- 离线使用

**生成方法**：
```bash
python build-single.py
```

**API 挂接点**：
- `loadGeoJSONFromStorage()` → 加载 GeoJSON
- `saveCurrentState()` → 保存 GeoJSON
- `TimelineManager.saveSnapshot()` → 快照管理

---

## ⚙️ 配置

### 高德地图 API Key（可选）
仅 **搜索地址** 功能需要 API Key：

```javascript
// script.js 第 2 行
const AMAP_API_KEY = '你的密钥';
```

申请地址：[高德开放平台](https://lbs.amap.com/)

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| [CHANGELOG.md](CHANGELOG.md) | 完整版本更新日志 |
| [updatedocs/PRODUCT_PLAN_P0.md](updatedocs/PRODUCT_PLAN_P0.md) | 产品规划与优先级 |
| [updatedocs/API_REFERENCE.md](updatedocs/API_REFERENCE.md) | API 参考文档 |
| [updatedocs/DEVELOPER_GUIDE.md](updatedocs/DEVELOPER_GUIDE.md) | 开发指南 |
| [GitHub部署指南.md](GitHub部署指南.md) | GitHub Pages 部署教程 |
| [使用说明-面板控制.md](使用说明-面板控制.md) | 面板控制说明 |

---

## 🛠️ 技术栈

- **地图引擎**: [Leaflet](https://leafletjs.com/) v1.9.4
- **绘图工具**: [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw)
- **点聚合**: [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- **表格组件**: [Tabulator](http://tabulator.info/) v5.5
- **Excel 处理**: [SheetJS (xlsx)](https://github.com/SheetSheetJS/sheetjs)
- **图标库**: [Font Awesome](https://fontawesome.com/) v6.4
- **样式**: 纯 CSS（无框架依赖）

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📝 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Leaflet](https://leafletjs.com/) - 优秀的开源地图库
- [geojson.io](https://geojson.io) - 灵感来源
- [OpenStreetMap](https://www.openstreetmap.org/) - 底图数据贡献者
