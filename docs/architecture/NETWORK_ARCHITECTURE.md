# Lila Home — 网络架构设计（Stage 0-02）

> 文档：`docs/architecture/NETWORK_ARCHITECTURE.md`
> 状态：设计（PLANNED，未实施、未部署、未测试）
> 依据：服务器只读审计（`docs/audit/SERVER_AUDIT.md`）、开源审计（`docs/audit/OPEN_SOURCE_AUDIT.md`）、设备兼容性审计（`docs/audit/DEVICE_COMPATIBILITY.md`）、网络与架构核实报告（2026-11-19，公开资料核实）
> **核实说明：四方 VPN 比较已按 2026-11-19 网络核实报告补全（见 3.2 节）。仍保留的 UNKNOWN：各家免费额度当日准确口径、控制面宕机时既有隧道是否维持、Headscale 官方 FAQ 关于 Docker/反向代理的原文——均须以官方当日页或实测确认，不得作为已核实结论。**

## 1. 设计目标

- 公网 VPS 只负责平台、用户管理、API 和远程访问。
- 家庭局域网运行 Home Assistant，负责设备接入和本地控制。
- 两者通过安全 VPN 连接。
- **不得直接将 Home Assistant、MQTT、数据库等管理端口暴露在公网。**
- 断网后家庭本地控制不受影响；VPS 故障后家庭本地控制不受影响。

## 2. 网络拓扑图（ASCII）

```
                        互联网
                           |
                 +---------+---------+
                 |  公网 VPS（火花面板）|
                 |  3.12.156.80      |
                 |  Ubuntu 24.04.5   |
                 |  Nginx 80/443     |
                 |  Lila Home API/Web|
                 |  PostgreSQL/MQTT  |
                 |  (仅回环/内网监听)|
                 +---------+---------+
                           |
                    VPN 隧道（待选型，见 3 节）
                    Tailscale / Headscale 首选研究
                           |
                 +---------+---------+
                 |  家庭局域网         |
                 |  家庭路由器（型号待确认）|
                 +---------+---------+
                           |
        +------------------+------------------+
        |                  |                  |
  Home Assistant 主机   Zigbee/Thread     各品牌设备
  （HAOS 或容器，未定）  协调器/边界路由   （灯/空调/热水器/
        |              （硬件待确认）    音响/路由器）
        +-- mDNS/发现（仅 LAN 内）--+
        +-- Matter/Thread/Zigbee --+
        +-- 厂商 LAN API / 云 API -+

  控制终端：Web / iPhone / iPad / Windows / macOS
  —— 远程经 VPS + VPN；在家经 LAN 直连 HA/Lila Home
```

说明：家庭 LAN 的具体网段、路由器型号、HA 主机形态均未提供，图中只画逻辑位置，不画具体 IP。家庭设备 IP、Token、密码一律不得写入本文档（见 `docs/architecture/SECURITY_DESIGN.md`）。

## 3. VPN 方案比较

### 3.1 已核实事实（以开源审计报告为准）

**Tailscale**

- 官方 GitHub：https://github.com/tailscale/tailscale；LICENSE：BSD-3-Clause（原文已核实）。
- 基于 WireGuard 的 Mesh VPN：设备组成私有 tailnet，能直连则直连、否则经 DERP 中继。
- 最新稳定版：v1.104.5 已确认（2026-11-03）；v1.104.7（2026-11-12）仅单一二手来源，须复核。
- v1.104.4（2026-10-28）修复安全公告 TS-2026-014 至 -017 的 SSH/Serve 问题。
- **关键区分：仅客户端/CLI/DERP 代码开源；协调控制面为 Tailscale Inc. 闭源托管服务，不受 BSD-3-Clause 覆盖；使用托管服务须遵守其服务条款与定价（Personal 免费版限 6 用户、非商业用途）。**
- 客户端覆盖 Linux、Windows、macOS、iOS、Android、tvOS 等。

**Headscale**

- 官方 GitHub：https://github.com/juanfont/headscale；官方文档：https://headscale.net/stable；LICENSE：BSD-3-Clause（原文已核实）。
- 开源自托管的 Tailscale 协调（控制面）服务器实现，配合官方 Tailscale 客户端组建自有 tailnet；README 声明与 Tailscale Inc. 无关联。
- 最新稳定版：v0.29.7（2026-10-30）；v0.29.7 为对应安全发布。
- 依赖：Go 单二进制；官方 Tailscale 客户端（0.29.x 要求客户端 ≥v1.80.0，目标支持最近 10 个客户端版本）；默认 SQLite（支持 PostgreSQL 但上游不推荐）；可选 OIDC。
- **版本注意：项目仍为 0.x（pre-1.0），小版本之间存在破坏性变更，须按次序逐个小版本升级。**

### 3.2 比较表（2026-11-19 公开资料核实）

| 维度 | Tailscale（托管） | Headscale（自托管控制面） | WireGuard（原生） | ZeroTier |
|---|---|---|---|---|
| 本质 | WireGuard 之上的托管 Mesh VPN：WireGuard 数据面 + 闭源托管控制面 | 开源自托管的 Tailscale 控制面实现；客户端仍用官方 Tailscale 客户端 | 协议本身，非服务；Linux 内核自 5.6 起内置 | 自有协议的 Mesh 虚拟网络，非 WireGuard 之下；VL1 加密 P2P + VL2 虚拟以太网 |
| 控制面 | Tailscale Inc. 闭源托管 | 自托管开源实现 | 无集中控制面，需自行管理配置/密钥分发 | 托管控制器（my.zerotier.com）或自建；自建控制器新版下有“非商业”限制的说法，须以官网当日页为准 |
| 数据面 | WireGuard（已核实） | 官方 Tailscale 客户端，WireGuard 数据面（已核实） | WireGuard：Curve25519 + ChaCha20-Poly1305，Cryptokey Routing（官方 https://www.wireguard.com/） | 自有协议，UDP/9993；比较文称 Curve25519 密钥交换 + AES-GMAC-SIV 或 Salsa20/Poly1305（二级来源） |
| 网络层 | L3，仅 IP；不支持广播/组播 | L3，仅 IP | L3，仅 IP | **L2+L3**：虚拟以太网，广播/组播可跨站工作——四者中唯一原生支持 mDNS/SSDP 跨站 |
| NAT 穿透/中继 | DERP 中继（已核实），自动打洞 | 同 Tailscale；默认用 Tailscale 公共 DERP，也可启用 Headscale 内嵌 DERP 自建中继 | **无内置穿透/发现**：需已知端点；双 NAT 后需有公网 IP 的中继（常为 VPS）或一方可达；可用 `PersistentKeepalive` 维持 | 自动 P2P 打洞，失败时经 planet/moon 中继 |
| 是否需公网 IP / 开端口 | 客户端一般无需开入站端口、无需公网 IP；仅出站 TCP 443 即可；为直连性能可选开 UDP 41641 入站 | 控制面服务器必须公网可达：域名 + TCP 443（官方强烈建议 HTTPS/443）；节点本身同 Tailscale，无需各自开端口 | **服务端需公网 IP + 开 UDP 端口**（惯例 51820，可改）；客户端只需出站 UDP 到服务端；家庭侧只作客户端则无需开端口 | 一般无需端口转发/公网 IP；用 UDP/9993 出站打洞 |
| 开源许可 | 客户端 BSD-3-Clause；控制面闭源 | BSD-3-Clause | 本轮未逐项核实，写 UNKNOWN | 客户端与控制器许可本轮未逐项核实，写 UNKNOWN |
| iOS 客户端 | 有官方客户端（已核实覆盖 iOS；App Store 页要求 iOS 16.6+，版本 1.104.6） | 用官方 Tailscale iOS 客户端（已核实） | 有官方 WireGuard iOS 应用（WireGuard 官网列 iOS 为支持平台） | 有 ZeroTier One iOS 应用（多源称有；未打开 App Store 页核对版本号） |
| 免费/成本 | Personal 免费版限 6 用户、非商业用途（开源审计已核实）；但另有来源称 100 设备/3 用户或 2026 年 4 月后 6 用户/不限个人设备——**口径冲突，以 tailscale.com/pricing 当日页为准** | 自托管，无 Tailscale 托管费用；服务器成本自理；单 Go 二进制约 50MB | 软件 $0；成本 = VPS（已有）+ 运维时间；无按座计费 | 免费额度已多次收紧且来源冲突：2023 年 25 节点 → 2024 年 10 设备 → 2026 年 10 月新账号 Personal 为 10 设备/1 网络/1 管理员、非商业；Essential 起价 $18/月（含 10 设备，超出 $2/设备）。**决策前必须以 zerotier.com/pricing 当日页为准** |
| 运维负担 | 低（托管控制面） | 中（自管控制面 + 升级须逐版本） | 中~高（每台设备手工配密钥，新增设备运维成本高；无自动发现） | 中；免费额度最小，吞吐上限低于 WireGuard（比较文称 300–500 Mbit/s，未验证） |
| 断网/控制面宕机 | 已建立的直连隧道按架构不应经控制面转发流量，但新节点发现/密钥轮换/ACL 下发会受影响；**控制面宕机是否中断既有隧道，未找到官方明确表述——UNKNOWN** | 控制面在自有 VPS 上：VPS 宕机则新节点无法注册/发现；既有隧道命运同 Tailscale，UNKNOWN | 无控制面依赖：已配好的隧道只要两端网络通即可工作 | 依赖控制器做发现/授权；既有 P2P 会话在控制器宕机后能否维持，**未核实——UNKNOWN** |
| 适合本项目 | 首选研究对象之一 | 首选研究对象之一（自托管偏好时） | 备选：VPS 作 Hub 最简单可靠，但手工运维成本高 | 专项备选：仅当明确需要 L2 广播/组播跨站时考虑，不作通用首选 |

### 3.3 推荐排序（设计建议，非实测结论）

1. **Tailscale 托管（家庭自用起步）**：零配置 Mesh + 自动 NAT 穿透（含 CGNAT）+ DERP 兜底 + 官方 iOS 客户端 + Subnet Router 可覆盖未装客户端的 LAN 设备；Personal 免费额度对单家庭足够（以当日官网为准）。代价：控制面依赖第三方；数据面仍为端到端 WireGuard 加密。
2. **Headscale 自托管**：与首选同等客户端体验与数据面，控制面自主、无按座费用；适合后续“去第三方依赖”演进。代价：需自行运维控制面 VPS、域名、HTTPS、DERP 与升级，并承担上游协议兼容风险；初期不建议与生产 HA 同机部署（据二手转述的 FAQ 限制，需复核官方 FAQ 原文）。
3. **原生 WireGuard（VPS 作 Hub）**：零第三方依赖、最简协议、官方跨平台；VPS 已有公网 IP，服务端开一个 UDP 端口即可；家庭侧只出站。代价：无自动发现/穿透，新增设备手工配密钥；双 NAT 客户端之间需经 VPS 中继；无 L2/组播。
4. **专项备选 ZeroTier**：仅当明确需要 **L2 广播/组播跨站**（如必须让远程手机像在 LAN 内一样发现 mDNS 设备且不愿在家庭侧部署反射器/HA 代理）时考虑。代价：免费额度最小（新账号 10 设备）、协议非 WireGuard、吞吐与生态弱于前三者；不作为通用首选。

**四者都不能替代本地 HA；VPN 只解决“远程到达家庭 LAN”，设备发现与控制仍由 LAN 内的 HA 完成。**

**本阶段不安装、不配置任何 VPN。** 服务器审计已确认：火花面板未装 Tailscale/WireGuard（`tailscale: command not found`），该状态保持到 Stage 1 批准后才变。

## 4. 数据流向

| 流向 | 路径 | 说明 |
|---|---|---|
| 用户远程控制 | 终端 → HTTPS → VPS Nginx → Lila Home API → VPN → 家庭 HA → 设备 | VPS 只做 API 与鉴权，不直连设备 |
| 用户在家控制 | 终端 → LAN → Lila Home API 或 HA | 优先本地路径，不绕公网 |
| 设备状态上报 | 设备 → HA（LAN）→ VPN → VPS API → PostgreSQL | 状态以 HA 回执为准（见 8 节状态机） |
| 设备发现 | 仅在家庭 LAN 内（mDNS/Zigbee/Matter） | 不跨公网发现 |
| 厂商云 | HA/设备 → 厂商云（仅 B 级设备需要） | 云路径只用于云 API 设备，本地设备不走云 |
| 自动化执行 | HA 本地规则引擎 | 断网仍可执行本地自动化 |

## 5. 安全边界

1. **公网边界**：VPS 只暴露 80/443（Nginx）与 22（SSH，按现有配置）。Home Assistant（计划 8123）、MQTT（计划 1883）、PostgreSQL（计划 5432）、Redis（计划 6379）**一律不暴露公网**，只绑回环或 VPN 内网。审计已确认这 5 个端口在主机上当前空闲，不代表可直接暴露——空闲≠可暴露。
2. **VPN 边界**：VPS 与家庭 LAN 之间只通 VPN 隧道；VPN 凭证与密钥只存本地秘密管理，不得进仓库。
3. **LAN 边界**：HA 与设备同 LAN；mDNS、Zigbee、Thread、Matter 发现只在 LAN 内有效。
4. **应用边界**：所有设备操作必须经过 Lila Home 统一服务层（见 `SYSTEM_ARCHITECTURE.md`）；前端不得直连 HA 或 MQTT。
5. **现有业务边界**：Lila Home 与现有业务（Personal AI Gateway、dy-portal、douyin-sparkflow、3x-ui、mihomo）共用一台服务器时，容器网络、数据卷、端口必须隔离；不得复用 infra-db-1。

## 6. 家庭局域网设备发现与协议要求

以下事实以设备兼容性审计报告为准：

- **mDNS 广播限制**：mDNS/Bonjour 发现只在同一 LAN/子网内有效，不跨公网、不跨 VPN 子网自动传播。HomeKit Device 发现靠 zeroconf/mDNS，需配对码。解法方向（设计，未验证）：HA 本身在 LAN 内做发现代理，VPS 不参与发现；跨子网场景须在 Stage 1 实测后定，不预设 mDNS 反射方案可用。
- **Matter 网络要求**：HA 自身为 Matter controller（Matter Server）；Matter-over-Wi-Fi 无需 border router；Thread 设备需 Thread border router（HA Connect ZBT-2 / Apple TV 4K / HomePod mini 等）；HAOS 为唯一官方支持的 Matter Server 运行方式，容器需另跑 Matter Server Docker 镜像。**公网 VPS 不能直接当 Matter 控制器。**
- **Thread 网络要求**：需 border router；HA 可用自有 OpenThread Border Router，也可复用 Apple/Google 的 border router，但 HA 只能配置/控制 OpenThread border router。
- **Zigbee 协调器接入方式**：ZHA 为 HA 内置；Zigbee2MQTT 为独立服务，经 MQTT discovery 自动把设备加入 HA，需 Mosquitto broker + Zigbee 协调器硬件（USB/以太网）。协调器接在 HA 主机本地（USB 直连）或经网络接入，Stage 1 按硬件定。
- **HomeKit 发现和控制机制**：HAP 协议；发现靠 zeroconf/mDNS；需配对码；同一时间只能配对一个控制器（Matter 设备除外，可多 fabric 共享）；已配对 Apple Home 的设备须先解除配对才能由 HA 接管。
- **华为/鸿蒙智联**：鸿蒙智联 ≠ Matter；只有同时带 Matter 认证的设备才能经 HA Matter 集成接入。

## 7. 远程访问方案

- 用户在外：终端 → HTTPS（VPS）→ 鉴权（JWT/Session + RBAC）→ API → VPN → HA → 设备。
- 用户在家：优先 LAN 直连，不绕公网；VPS 不可用时本地路径仍可用（见 8 节）。
- 管理员远程运维：经现有 SSH 通道（22 端口已监听），不另开管理端口；VPN 管理面不暴露公网。
- 不做方案：不把 HA 管理界面、MQTT、数据库端口直接映射到公网；不给设备配公网 IP。

## 8. 断网、VPS 故障与恢复策略

### 家庭断网（家庭宽带中断，LAN 仍通）

- HA 本地继续工作：本地设备（A 级）控制、本地自动化、本地状态读取不受影响。
- 云依赖设备（B 级）不可用：小米云、美的云 Token 相关功能、语音助手云服务暂停，恢复后自动重连（重连行为须 Stage 1 实测）。
- VPS 远程访问中断：远程控制不可用，属预期降级，不视为 HA 故障。
- 红外设备（C 级）：本地红外发射仍可工作，但状态仍无法回读。

### VPS 故障（VPS 宕机或 VPN 中断，家庭 LAN 正常）

- 家庭本地控制不受影响：HA 在 LAN 内独立运行。
- 远程控制、远程状态查看、云端 API 聚合暂停。
- 恢复后：VPN 重连、状态重新同步（以 HA 实时状态为准，不以 VPS 缓存为准）；同步冲突时以设备真实状态为准。

### 恢复策略

- VPS 侧：PostgreSQL 数据卷与配置卷须有备份（备份目标与周期 Stage 1 定）；恢复时先恢复数据库，再恢复 API，最后重建 VPN。
- 家庭侧：HA 配置备份（HA 自身备份机制）须定期做；Zigbee/Thread 网络密钥、Matter 配对信息须备份，丢失后须重新配对（该后果须在用户手册中写明）。
- 演练要求：Stage 1 至少做一次断网演练与一次 VPS 故障演练，记录实际恢复时间；演练前不得宣称恢复能力。

## 9. 待确认事项

1. 家庭路由器型号/固件、LAN 网段、HA 主机形态（HAOS 硬件 / 容器 / 虚拟机）——未提供。
2. VPN 最终选型（Tailscale 托管 vs Headscale 自托管 vs 原生 WireGuard）——待用户定；决策前须以 tailscale.com/pricing 与 zerotier.com/pricing 当日页复核免费额度口径，控制面宕机时既有隧道是否维持须以官方文档或实测确认。
3. 是否接受 VPS 与家庭 LAN 之间只通 VPN、HA 管理端口永不暴露公网——须用户确认。
4. 家庭宽带是否有公网 IP / 是否需要 VPS 做中继——未提供，UNKNOWN。
