# Lila Home — 数据库设计（Stage 0-05）

> 文档：`docs/architecture/DATABASE_DESIGN.md`
> 状态：设计（PLANNED，未实施、未建表、未迁移）
> 数据库：PostgreSQL（独立实例，与现有 infra-db-1 隔离；infra-db-1 为 postgres:16-alpine，属 Personal AI Gateway 业务，不得复用）
> 原则：实时设备状态以 Home Assistant 为准，数据库只存元数据、快照与历史；敏感字段（Token/密码/密钥）一律不存明文，见 `SECURITY_DESIGN.md`。

## 1. 设计原则

1. 用户、设备元数据、房间、场景、审计日志是核心；设备实时状态不以数据库为唯一来源。
2. 所有表带 `created_at` / `updated_at`；删除用软删除（`deleted_at`），审计相关表永不物理删除。
3. 设备标识以外键关联 HA 实体 ID（`ha_entity_id`），不以设备 IP 为主键（IP 会变）。
4. 厂商 Token、密码、密钥**不得存入数据库明文**；如必须存引用，只存本地秘密管理的引用名，不存值。
5. 迁移用版本化迁移脚本，生产迁移前先验证兼容性并保留可恢复备份（沿用用户既定的持续部署制度）。

## 2. 实体关系图（文字）

```
users (用户) 1──* user_roles (用户角色) *──1 roles (角色)
users 1──* sessions (会话)
users 1──* audit_logs (审计日志)

rooms (房间) 1──* devices (设备)
devices 1──* device_states (状态快照/历史)
devices 1──* device_commands (控制指令记录)
devices *──* integrations (接入集成，关联表 device_integrations)

scenes (场景) *──* devices (场景动作，关联表 scene_actions)
scenes 1──* scene_runs (场景执行记录)
automations 与 scenes 的关系：Stage 1 定（HA 自动化与 Lila 场景的映射）
```

## 3. 表设计（草案）

### 3.1 users（用户）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 登录邮箱 |
| password_hash | VARCHAR(255) | NOT NULL | Argon2id 或 bcrypt 哈希，只存哈希，不存明文（算法 Stage 1 定） |
| display_name | VARCHAR(100) | | 显示名 |
| is_owner | BOOLEAN | NOT NULL DEFAULT FALSE | Owner 唯一，初始化后不得随意变更 |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE | |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | NULL | 软删除 |

### 3.2 roles / user_roles（角色与授权）

| 表 | 字段 | 说明 |
|---|---|---|
| roles | id UUID PK；name VARCHAR(50) UNIQUE（Owner / Admin / Member / Viewer）；description TEXT | 角色定义 |
| user_roles | user_id FK → users；role_id FK → roles；PK (user_id, role_id) | 多对多 |

权限粒度见 `SECURITY_DESIGN.md`（RBAC）：Viewer 只读；Member 可控已授权设备；Admin 可管设备与场景；Owner 可管用户与安全设置。

### 3.3 sessions（会话）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users | |
| token_hash | VARCHAR(255) | NOT NULL | 只存 SHA256 哈希，不存 Token 明文 |
| device_info | VARCHAR(255) | | 终端描述（Web/iPhone/iPad/Windows/macOS） |
| ip_address | INET | | 登录 IP（审计用） |
| expires_at | TIMESTAMPTZ | NOT NULL | |
| revoked_at | TIMESTAMPTZ | NULL | 吊销时间 |
| created_at | TIMESTAMPTZ | NOT NULL | |

### 3.4 rooms（房间）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| name | VARCHAR(100) | NOT NULL | 如 客厅、卧室 |
| sort_order | INT | NOT NULL DEFAULT 0 | |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | NULL | 软删除 |

### 3.5 integrations（接入集成）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| name | VARCHAR(100) | NOT NULL | 如 `midea`、`xiaomi_miot`、`matter`、`homekit_controller` |
| kind | VARCHAR(50) | NOT NULL | official / community / custom |
| protocol | VARCHAR(50) | | Matter / Zigbee / MQTT / HomeKit / LAN API / 云 API / 红外 |
| is_enabled | BOOLEAN | NOT NULL DEFAULT TRUE | |
| config_ref | VARCHAR(255) | | 本地秘密管理中的配置引用名，不存敏感值 |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |

### 3.6 devices（设备）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| room_id | UUID | FK → rooms, NULL | 未分组设备允许为空 |
| integration_id | UUID | FK → integrations | |
| name | VARCHAR(100) | NOT NULL | 用户自定义名 |
| brand | VARCHAR(50) | | 小米/华为/Apple/美的/其他 |
| model | VARCHAR(100) | | 型号；未知写 UNKNOWN，不编造 |
| device_type | VARCHAR(50) | NOT NULL | router / speaker / light / climate / water_heater / other |
| ha_entity_id | VARCHAR(255) | UNIQUE | HA 实体 ID，如 `light.ke_ting`；未接入时为空 |
| compatibility_grade | CHAR(1) | | A/B/C/D；未核实为空 |
| is_online | BOOLEAN | NOT NULL DEFAULT FALSE | 最后已知在线状态（快照，非实时保证） |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | NULL | 软删除 |

**不存字段**：设备 IP、Token、密码、配对码——这些只在 HA 侧或本地秘密管理中保存，不进 Lila Home 数据库。

### 3.7 device_states（设备状态快照/历史）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| device_id | UUID | FK → devices | |
| state | JSONB | NOT NULL | HA 回执的状态快照（开关、亮度、温度等） |
| source | VARCHAR(50) | NOT NULL | ha_push / ha_poll / command_receipt |
| recorded_at | TIMESTAMPTZ | NOT NULL | |

说明：只存快照与历史，不作为实时控制依据；实时状态以 HA 为准。保留周期 Stage 1 定（建议按时间分区或定期归档）。

### 3.8 device_commands（控制指令记录）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| device_id | UUID | FK → devices | |
| user_id | UUID | FK → users | 操作人 |
| command | JSONB | NOT NULL | 指令内容（目标状态） |
| status | VARCHAR(20) | NOT NULL | ACCEPTED / EXECUTING / CONFIRMED / FAILED / TIMEOUT / UNKNOWN（见 API 设计） |
| ha_result | JSONB | | HA 回执原文或错误信息 |
| created_at / completed_at | TIMESTAMPTZ | | |

说明：每一次控制操作必留记录，供审计与故障排查；状态机以 HA 回执为准，不以“请求发出”为准。

### 3.9 scenes（场景）与 scene_actions

| 表 | 字段 | 说明 |
|---|---|---|
| scenes | id UUID PK；name VARCHAR(100) NOT NULL；description TEXT；is_enabled BOOLEAN DEFAULT TRUE；created_by FK → users；created_at/updated_at；deleted_at | 场景定义 |
| scene_actions | id UUID PK；scene_id FK → scenes；device_id FK → devices；action JSONB NOT NULL；sort_order INT | 场景内每台设备的目标动作 |
| scene_runs | id UUID PK；scene_id FK → scenes；triggered_by FK → users；status VARCHAR(20)；started_at/completed_at；result JSONB | 每次执行留记录 |

### 3.10 audit_logs（审计日志）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users, NULL | 系统操作可为空 |
| action | VARCHAR(100) | NOT NULL | 如 device.control / user.login / scene.run / config.change |
| target_type / target_id | VARCHAR(50) / UUID | | 操作对象 |
| detail | JSONB | | 脱敏后的操作详情（不得含 Token/密码） |
| ip_address | INET | | |
| created_at | TIMESTAMPTZ | NOT NULL | |

说明：审计日志只追加、不修改、不删除；保留周期 Stage 1 定。

## 4. 索引建议（草案）

- `devices(ha_entity_id)` UNIQUE；`devices(room_id)`；`devices(device_type)`。
- `device_states(device_id, recorded_at DESC)`。
- `device_commands(device_id, created_at DESC)`；`device_commands(user_id, created_at DESC)`。
- `audit_logs(user_id, created_at DESC)`；`audit_logs(action, created_at DESC)`。
- `sessions(user_id, expires_at)`。

## 5. 未定事项

- 密码哈希算法（Argon2id 优先，Stage 1 定）。
- 状态快照保留周期与归档策略。
- HA 自动化与 Lila 场景的映射关系。
- Redis 引入后，会话与缓存的存放位置（初期无 Redis，会话存 PostgreSQL）。
