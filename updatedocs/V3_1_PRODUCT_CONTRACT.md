# v3.1 决策工作台产品与数据契约

> 基线：v3.0.2
> 目标版本：v3.1.0-beta.1
> 更新时间：2026-08-17

## 本阶段目标

v3.1 只解决“管理层能否看懂门店网络”这个问题，不提前实现经营时间轴和选址模型计算。

交付范围：

- 默认查看模式的决策工作台应用壳。
- 总览 KPI、区域/状态筛选、搜索和位置列表。
- 查看/编辑模式明确分离，旧地图工具保留在编辑模式。
- Workspace schema v2、稳定门店 ID 和 v1 非破坏迁移。
- 可用于测试的虚构门店网络数据。

不在本版本实现：

- 经营事件录入和时间播放；属于 v3.2。
- 自定义选址模型和评分；属于 v3.3。
- 经营数据 API、登录和多人协作；分别属于 v3.4/v4。

## 五个验收任务

1. 管理层打开应用，30 秒内确认位置总数、在营数、候选/筹备数、闭店数和覆盖区域。
2. 按区域、状态或关键词筛选，KPI、位置列表和地图标记同步变化。
3. 点击位置列表，地图定位到对应门店并打开弹出信息。
4. 默认查看模式看不到清空、绘图和代码编辑等危险工具；主动进入编辑模式后旧能力仍可用。
5. 导入旧 GeoJSON 或读取 v1 工作区后自动形成 v2 门店对象，旧存储键不被删除。

## 门店字段契约

| 标准字段       | 必填 | 导入别名                          | 说明                                           |
| -------------- | ---- | --------------------------------- | ---------------------------------------------- |
| `locationId`   | 是   | `storeId`、门店编号、门店ID、`id` | 企业内稳定且唯一；缺失时生成确定性临时 ID      |
| `name`         | 是   | 名称、门店、店名                  | 门店或候选点显示名称                           |
| `locationType` | 否   | `entityType`、位置类型、对象类型  | `store/candidate/competitor/warehouse/other`   |
| `status`       | 否   | `state`、状态、门店状态           | `planned/preparing/open/paused/closed/unknown` |
| `brand`        | 否   | 品牌                              | 品牌或业务线                                   |
| `region`       | 否   | 区域、城市、`city`                | v3.1 的管理筛选维度                            |
| `address`      | 否   | 地址、详细地址                    | 位置详情和搜索字段                             |
| `openedAt`     | 否   | 开业日期                          | ISO 日期；v3.2 纳入生命周期重建                |
| `closedAt`     | 否   | 闭店日期                          | ISO 日期；v3.2 纳入生命周期重建                |

GeoJSON 继续作为空间交换格式；Point 会规范为 `LocationEntity`，线面保留为分析要素，不错误计入门店数。

## Workspace schema v2

v2 在保留 `features/groups/snapshots/popupConfig/legacy` 兼容字段的同时，新增：

- `locations`
- `areas`
- `records`
- `eventSeries`
- `selectionModels`
- `selectionScenarios`
- `decisions`
- `savedViews`
- `dataSources`
- `audit`

存储键为 `geomap.workspace.v2`。读取顺序为 v2 → v1 → 历史散列键；任何迁移路径都不删除来源数据。

## 演示数据

`examples/decision-demo.geojson` 是纯虚构数据，用于 v3.1 UI、筛选、迁移和截图测试。它不代表真实企业、品牌或经营表现，不可用于业务判断。

## 退出条件

- 五个验收任务全部通过。
- Full/Lite 首屏无未预期控制台错误。
- Pages 与 Full/Lite 单文件构建通过。
- v1 工作区和旧 GeoJSON 回归通过。
- 1440×900、平板和手机查看模式布局可用。
