# GeoJSON Map Editor | GeoJSON 地图编辑器

<div align="center">

[![Version](https://img.shields.io/badge/version-v2.14.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/github-Geomap--app-181717.svg?logo=github)](https://github.com/Superhedgehoger/Geomap-app)

**[English](#english) | [简体中文](#简体中文)**

</div>

---

<a name="english"></a>
## English

> ⚠️ **Privacy Notice**: This project does not contain any real or test business data, only code structure and functionality.

A fully-featured **professional GeoJSON map editor**, similar to [geojson.io](https://geojson.io), built with Leaflet. Supports advanced layer management, timeline snapshots, marker grouping, box selection, and other enterprise-grade features.

### ✨ Core Features

#### 🎨 Drawing & Editing
- **Drawing Tools** - Markers, polylines, polygons, rectangles, circles (Leaflet.draw)
- **Icon Customization** - 30+ Font Awesome icons + color picker
- **Property Editor** - Real-time sidebar editing of marker properties
- **Style Editor** - Visual adjustment of color, opacity, line width

#### 📂 Layer Management
- **Folder Organization** - Custom groups displayed as collapsible folders
- **Visibility Control** - Toggle with eye icon, hidden layers show as faded + strikethrough
- **Batch Operations** - Box selection, multi-select, group management
- **Search & Filter** - Quickly locate layers

#### 📸 Timeline Snapshots
- **State Saving** - Save map state (layers, styles, view)
- **Snapshot Management** - Rename, delete, **copy** snapshots
- **Browse Mode** - Read-only history viewing to prevent accidents
- **Time Navigation** - Click snapshots to switch between time points

#### 🎯 Professional Selection Tools
- **Shift + Drag Box Selection** - Draw rectangle to select all markers within
- **Ctrl + Click Multi-select** - Quickly add/remove individual markers
- **ESC Quick Exit** - Clear selection and exit selection mode instantly
- **Visual Feedback** - Blue dashed selection box + highlighted markers + live count

#### 🎯 Radius Rings
- **Coverage Display** - Show circular coverage areas around markers
- **5 Preset Radii** - 1.5km, 2km, 3km, 5km, 10km
- **Real Geographic Distance** - Uses `L.circle` for accurate map scaling
- **Full Synchronization** - Rings hide/delete/move with markers

#### 🗺️ Data Import/Export
- **GeoJSON Import/Export** - Full format support (FeatureCollection)
- **Excel Import/Export** - Supports `.xlsx` with all fields and coordinates
- **Batch Import** - Supports multiple markers at same coordinates (auto-grouped)
- **CSV Support** - Bulk coordinate import

#### 📊 Data Views
- **Table View** - Tabulator integration, virtual scroll, smooth rendering for 5000+ rows
- **Cell Editing** - Double-click to edit, real-time sync to map
- **Four-way Sync** - Table ↔ Map ↔ Layer Panel ↔ Property Editor synchronized
- **Statistics Dashboard** - Real-time marker counts, type distribution, group statistics

### 🚀 Quick Start

#### Live Demo
Visit GitHub Pages deployment:  
🔗 **[https://superhedgehoger.github.io/Geomap-app/](https://superhedgehoger.github.io/Geomap-app/)**

#### Run Locally

```bash
# Clone repository
git clone https://github.com/Superhedgehoger/Geomap-app.git
cd Geomap-app

# Start local server (choose one)
python server.py           # Recommended
# or
python -m http.server 8000
```

Visit: `http://localhost:8000`

### 📦 Distribution Versions

#### Lite Version
Lightweight version focused on core map editing (without event tracker):  
🔗 **[Geomap-app-lite](https://github.com/Superhedgehoger/Geomap-app-lite)**

### 🛠️ Tech Stack

- **Map Engine**: [Leaflet](https://leafletjs.com/) v1.9.4
- **Drawing Tools**: [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw)
- **Marker Clustering**: [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- **Table Component**: [Tabulator](http://tabulator.info/) v5.5
- **Excel Processing**: [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs)
- **Icons**: [Font Awesome](https://fontawesome.com/) v6.4
- **Styling**: Pure CSS (no framework dependencies)

### 📝 License

MIT License - See [LICENSE](LICENSE) file

---

<a name="简体中文"></a>
## 简体中文

> ⚠️ **隐私声明**：本项目不包含任何真实或测试业务数据，仅提供代码结构与功能实现。

一个功能完整的 **专业级 GeoJSON 地图编辑器**，类似 [geojson.io](https://geojson.io)，基于 Leaflet 构建，支持高级图层管理、时间轴快照、组合标记、框选操作等企业级功能。

### ✨ 核心功能

#### 🎨 绘图与编辑
- **绘图工具** - 标记、折线、多边形、矩形、圆形（Leaflet.draw）
- **图标自定义** - 30+ Font Awesome 图标 + 颜色选择器
- **属性编辑器** - 侧边栏实时编辑标记属性（名称、类型、备注等）
- **样式编辑** - 颜色、透明度、线宽可视化调节

#### 📂 图层管理
- **文件夹组织** - 自定义组显示为可折叠文件夹
- **显隐控制** - 眼睛图标切换，隐藏图层半透明 + 删除线
- **批量操作** - 框选、多选、分组管理
- **搜索过滤** - 快速定位图层

#### 📸 时间轴快照
- **状态保存** - 保存地图状态（图层、样式、视图）
- **快照管理** - 重命名、删除、**复制**快照
- **浏览模式** - 只读浏览历史状态，防止误操作
- **时间线切换** - 点击快照即可切换不同时间点

#### 🎯 专业级选择工具
- **Shift + 拖动框选** - 绘制矩形选区，自动选中范围内标记
- **Ctrl + 单击多选** - 快速添加/移除单个标记
- **ESC 快捷退出** - 一键清空选中并退出选择模式
- **视觉反馈** - 蓝色虚线选区 + 高亮标记 + 实时计数

#### 🎯 标记半径范围圈
- **覆盖范围显示** - 显示以标记为中心的覆盖范围
- **5 个预设半径** - 1.5km、2km、3km、5km、10km
- **真实地理距离** - 使用 `L.circle` 实现地图缩放自适应
- **完全联动** - 范围圈随标记隐藏/删除/移动

#### 🗺️ 数据导入导出
- **GeoJSON 导入/导出** - 完整格式支持（FeatureCollection）
- **Excel 导入/导出** - 支持 `.xlsx`，包含所有字段与坐标
- **批量导入** - 支持同坐标多标记（自动合并为组）
- **CSV 支持** - 坐标批量导入

#### 📊 数据视图
- **表格视图** - Tabulator 集成，虚拟滚动，5000+ 行流畅渲染
- **单元格编辑** - 双击编辑，实时同步到地图
- **四向联动** - 表格 ↔ 地图 ↔ 图层面板 ↔ 属性编辑器同步选中
- **统计看板** - 实时显示标记数量、类型分布、自定义组统计

### 🚀 快速开始

#### 在线体验
访问 GitHub Pages 部署版本：  
🔗 **[https://superhedgehoger.github.io/Geomap-app/](https://superhedgehoger.github.io/Geomap-app/)**

#### 本地运行

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

### 📖 使用指南

#### 基本操作

##### 1. 添加标记
- 点击左侧工具栏的 **📍 标记工具**
- 在地图上点击添加标记
- 右键编辑属性（名称、类型、备注等）

##### 2. 导入数据
**Excel 导入** (推荐批量导入)：
```
| 名称     | 经度      | 维度     | 类型 |
|----------|-----------|----------|------|
| 北京银行 | 116.4074  | 39.9042  | 银行 |
| 星巴克   | 116.4074  | 39.9042  | 餐饮 |
```
→ 左侧面板 → **导入** → 上传 Excel → 自动生成标记

##### 3. 图层分组
- 进入选择模式：图层面板 → **📦 自定义组** → **选择标记创建组**
- 框选标记：按住 **Shift** 拖动鼠标绘制选区
- 完成创建：点击提示条的 **"完成创建"** 按钮 → 输入组名

##### 4. 标记范围圈
- **Ctrl+点击** 标记打开属性编辑器
- 在"范围圈"区块选择需要的半径（1.5km、2km 等）
- 地图上立即显示对应的覆盖范围圆圈

### 📦 分发版本

#### Lite 版本
轻量级版本，专注核心地图编辑功能（不含事件追踪器）：  
🔗 **[Geomap-app-lite](https://github.com/Superhedgehoger/Geomap-app-lite)**

### 🛠️ 技术栈

- **地图引擎**: [Leaflet](https://leafletjs.com/) v1.9.4
- **绘图工具**: [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw)
- **点聚合**: [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- **表格组件**: [Tabulator](http://tabulator.info/) v5.5
- **Excel 处理**: [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs)
- **图标库**: [Font Awesome](https://fontawesome.com/) v6.4
- **样式**: 纯 CSS（无框架依赖）

### 🤝 贡献

欢迎提交 Issue 和 Pull Request！

#### 开发流程
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 📝 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 Acknowledgments | 致谢

- [Leaflet](https://leafletjs.com/) - Excellent open-source map library | 优秀的开源地图库
- [geojson.io](https://geojson.io) - Inspiration source | 灵感来源
- [OpenStreetMap](https://www.openstreetmap.org/) - Base map contributors | 底图数据贡献者
