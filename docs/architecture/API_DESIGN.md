# Lila Home — API 设计（Stage 0-05）

> 文档：`docs/architecture/API_DESIGN.md`
> 状态：设计（PLANNED，未实施、未开发、未测试）
> 技术：Python + FastAPI + Pydantic + WebSocket
> 原则：所有设备操作必须经过统一服务层；前端不得直连 HA/MQTT/数据库；发送控制请求成功不代表设备执行成功。

## 1. 通用约定

- Base URL（规划）：`https://<域名>/api/v1`（域名 Stage 1 定；不得使用任务书外的 API 域名假设）。
- 认证：JWT 或安全 Session（二选一，Stage 1 定）；所有接口（除登录外）须带认证；RBAC 权限见 `SECURITY_DESIGN.md`。
- 请求/响应：JSON；时间统一 UTC ISO 8601；错误体统一 `{ "code": "...", "message": "...", "detail": ... }`。
- 分页：`?page=&page_size=`，默认 20，最大 100。
- 版本：URL 带 `/v1`；破坏性变更升版本，不静默改字段。

## 2. 控制状态机（核心约定）

发送控制请求成功，不代表设备执行成功。必须通过状态反馈或可靠的设备回执确认结果。

| 状态 | 含义 |
|---|---|
| ACCEPTED | 指令已接收、已鉴权、已记入 `device_commands`，尚未发往 HA |
| EXECUTING | 已发往 HA，等待回执 |
| CONFIRMED | HA 回执确认设备已达到目标状态（以回执状态为准） |
| FAILED | HA 回执失败，或设备明确拒绝 |
| TIMEOUT | 超时未收到回执（超时阈值 Stage 1 定） |
| UNKNOWN | 回执缺失或无法判断（如红外单向设备无回读能力，见下） |

**红外/单向设备（C 级）**：状态只能到 UNKNOWN（或 ACCEPTED/EXECUTING 后超时转 UNKNOWN），不得写 CONFIRMED；前端必须如实显示“已发送，未确认”，不得显示为“已执行”。

## 3. 接口清单（草案）

### 3.1 认证与会话

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/auth/login` | 邮箱+密码登录，返回 Token/Session | 公开（限流） |
| POST | `/auth/logout` | 吊销当前会话 | 登录用户 |
| POST | `/auth/refresh` | 刷新 Token（若用 JWT） | 登录用户 |
| GET | `/auth/me` | 当前用户信息与角色 | 登录用户 |

### 3.2 用户与角色

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/users` | 用户列表 | Owner/Admin |
| POST | `/users` | 创建用户 | Owner |
| GET | `/users/{id}` | 用户详情 | Owner/Admin/本人 |
| PATCH | `/users/{id}` | 修改用户（不含密码重置外的敏感操作） | Owner/Admin |
| POST | `/users/{id}/roles` | 赋角色 | Owner |
| POST | `/users/{id}/reset-password` | 重置密码（须审计） | Owner |

### 3.3 房间

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/rooms` | 房间列表 | 登录用户 |
| POST | `/rooms` | 创建房间 | Admin+ |
| PATCH | `/rooms/{id}` | 改名/排序 | Admin+ |
| DELETE | `/rooms/{id}` | 删除房间（软删除，设备移出分组） | Admin+ |

### 3.4 设备

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/devices` | 设备列表（可按房间/类型/品牌过滤） | 登录用户 |
| GET | `/devices/{id}` | 设备详情 + 最后已知状态快照 | 登录用户 |
| POST | `/devices` | 登记设备（只登记元数据，不直连设备） | Admin+ |
| PATCH | `/devices/{id}` | 改名/换房间/改等级（等级只可由核实流程改） | Admin+ |
| DELETE | `/devices/{id}` | 删除设备（软删除） | Admin+ |
| GET | `/devices/{id}/state` | 最后已知状态（注明来源与时间，注明是否为实时） | 登录用户 |

### 3.5 设备控制（核心）

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/devices/{id}/commands` | 发送控制指令，返回 command_id 与初始状态 ACCEPTED | Member+（须有该设备控制权） |
| GET | `/devices/{id}/commands/{command_id}` | 查询单条指令状态（ACCEPTED/EXECUTING/CONFIRMED/FAILED/TIMEOUT/UNKNOWN） | Member+ |
| GET | `/devices/{id}/commands` | 该设备的指令历史 | Member+ |

控制指令体示例（示意，非真实设备）：

```json
{
  "action": "turn_on",
  "params": { "brightness": 80 }
}
```

响应示例（示意）：

```json
{
  "command_id": "00000000-0000-0000-0000-000000000000",
  "status": "ACCEPTED",
  "device_id": "00000000-0000-0000-0000-000000000000"
}
```

**禁止行为**：控制接口不得接受“绕过安全保护”的参数（如热水器超温、燃气联锁解除）；此类参数须在 Pydantic 层拒绝并记审计日志。

### 3.6 灯光 / 空调 / 热水器 / 音响（业务视图接口）

以下为聚合接口，底层统一走 3.5 的指令接口，不另开直连通道：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/lights` | 灯光列表 + 状态（按房间分组） |
| GET | `/climate` | 空调列表 + 状态 |
| GET | `/water-heaters` | 热水器列表 + 状态 |
| GET | `/speakers` | 音响列表 + 状态 |
| GET | `/network/devices` | 家庭网络设备只读监控（在线客户端等，见 DEVICE_COMPATIBILITY.md 路由器只读限定） |

### 3.7 场景与自动化

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/scenes` | 场景列表 | 登录用户 |
| POST | `/scenes` | 创建场景 | Admin+ |
| PATCH | `/scenes/{id}` | 修改场景 | Admin+ |
| DELETE | `/scenes/{id}` | 删除场景（软删除） | Admin+ |
| POST | `/scenes/{id}/run` | 执行场景，返回 run_id | Member+ |
| GET | `/scenes/{id}/runs/{run_id}` | 执行结果（逐设备状态） | Member+ |

### 3.8 WebSocket（实时状态）

- 路径（规划）：`/ws`（认证后建立）。
- 服务端推送：设备状态变更（HA 回执驱动）、指令状态变更（ACCEPTED→EXECUTING→CONFIRMED/FAILED/TIMEOUT/UNKNOWN）、场景执行进度。
- 客户端不得经 WebSocket 绕过鉴权发控制指令；控制仍走 REST，WebSocket 只做订阅与推送。

### 3.9 系统与审计

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/system/health` | API 与依赖健康（HA 连通性、MQTT、DB，不含敏感信息） | Admin+ |
| GET | `/audit-logs` | 审计日志列表 | Owner/Admin |
| GET | `/integrations` | 接入集成列表与启用状态 | Admin+ |

## 4. 错误码（草案）

| code | 含义 | HTTP |
|---|---|---|
| `unauthorized` | 未登录或 Token 失效 | 401 |
| `forbidden` | 无该设备/该操作权限 | 403 |
| `not_found` | 设备/房间/场景不存在 | 404 |
| `validation_error` | 参数校验失败（含禁用的危险参数） | 422 |
| `device_offline` | HA 回执设备离线 | 502/504（Stage 1 定） |
| `device_timeout` | 等待回执超时 | 504 |
| `ha_unavailable` | HA/VPN 不可达 | 503 |
| `internal_error` | 服务端异常 | 500 |

## 5. 未定事项

- JWT vs Session 最终选型。
- 控制指令超时阈值（按设备类型区分）。
- WebSocket 断线重连与状态重同步策略。
- 厂商云 API 的服务端代理方式（B 级设备）与 Token 刷新机制。
