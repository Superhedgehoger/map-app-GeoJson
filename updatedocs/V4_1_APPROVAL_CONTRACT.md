# Geomap v4.1 决策审批契约

## 业务目标

审批用于把选址建议、签约边界、开闭店计划或其他经营结论从“地图上的当前内容”变成“对明确版本做出的管理决议”。它不代替电子签章、合同系统或法定审批流。

## 状态与不变量

```text
pending ──批准──> approved
   ├──驳回──> rejected
   └──撤回──> cancelled
```

- 只有已保存的 Workspace schema v2 可以提交审批。
- 每条记录保存 `workspaceVersion` 与提交时的完整快照；列表 API 不下发大快照。
- 同一人在同一工作区版本只能有一条待审记录。
- 提交人不能审批自己的记录；驳回必须填写意见。
- 终态不可修改。修订后应保存新工作区版本并重新提交。

## 公共字段

`DecisionApproval` 包含审批 ID、工作区 ID、工作区版本、可选实体引用、标题、摘要、状态、提交人/时间、审批人/时间、审批意见以及创建/更新时间。标题最长 120 字符，摘要和审批意见最长 4000 字符，实体引用最长 200 字符。

## API

| 方法    | 路径                                        | 最低权限 | 用途               |
| ------- | ------------------------------------------- | -------- | ------------------ |
| `GET`   | `/api/workspaces/:id/approvals`             | viewer   | 查看工作区全部审批 |
| `POST`  | `/api/workspaces/:id/approvals`             | editor   | 提交当前已保存版本 |
| `PATCH` | `/api/workspaces/:id/approvals/:approvalId` | admin    | 批准或驳回         |
| `PATCH` | 同上，`decision` 设为 `cancelled`           | 提交人   | 撤回待审记录       |

管理员可代为撤回异常待审记录。所有路由均在服务端校验组织归属和角色，并生成 `approval.submit` / `approval.approved` / `approval.rejected` / `approval.cancelled` 审计事件。

## 验收边界

- 查看者可看状态，不能提交或处理。
- 编辑者可提交和撤回自己的待审记录。
- 管理员只能处理他人提交的记录。
- 驳回空意见、自审、重复审批和未保存工作区都被服务端拒绝。
- 公开 Pages、Lite 和未配置私有 API 的单文件不会开启审批或上传数据。
