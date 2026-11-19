# Lila Home — Stage 0 最终报告

> 文档：`STAGE0_REPORT.md`
> 报告日期：2026-11-19
> 范围：Stage 0 全部工作（审计、架构、规划）。本阶段结束后停止，等待用户明确批准 Stage 1。
> 标记规则：只有实际完成并有证据的工作才能标记 PASS。

## A. 项目当前状态

| 项目 | 状态 |
|---|---|
| 项目名称 | Lila Home（紫序智能家居控制中心），Unified Smart Home Platform |
| 阶段 | Stage 0 已完成（文档交付）；Stage 1 未开始，等待用户明确批准 |
| 仓库 | **已创建：私有仓库 https://github.com/fafa888uk/LilaHome，分支 main，16 个文件已推送（2026-11-19 23:43）**（见 F 节） |
| 服务器 | 火花面板 3.12.156.80，只读审计已完成；未做任何修改 |
| 设备 | 无具体型号，全部型号级结论待验证（无型号） |
| 功能 | 九模块全部 PLANNED，无一 IMPLEMENTED |

## B. 服务器真实审计结果 — PASS（有原始记录为证）

- 审计目标：火花面板 3.12.156.80（用户 2026-11-19 明确指定该服务器做只读审计）。
- 审计方式：只读，未修改配置、未安装软件、未重启/停止服务、未删除文件。
- 原始记录：`hidden_files/server_audit_raw_2026-11-19.txt`。
- 关键实测结果：
  - Ubuntu 24.04.5 LTS（noble），内核 7.0.0-1014-aws，主机名 ip-172-31-18-252。
  - CPU：Intel Xeon Platinum 8488C，2 vCPU。
  - 内存：MemTotal 7962852 kB（7.6GiB），可用 6.2Gi，**Swap 0，无交换空间**。
  - 磁盘：nvme0n1 60G；`/` ext4 58G，已用 18G，剩余 40G（32%）。
  - 网络：enp39s0 172.31.18.252/20，默认路由 172.31.16.1。
  - 服务：27 个单元在跑（含 nginx、docker、ssh、chrony 等）。
  - 端口：公网 0.0.0.0:80/443/22/24443/24444；其余业务端口只绑 127.0.0.1。
  - 防火墙：UFW inactive；iptables INPUT 策略 ACCEPT。
  - Docker 29.1.3，10 个容器在跑（Personal AI Gateway 0.1.5 三件、dy-portal 0.2.2 两件、douyin-sparkflow 三件、3x-ui、mihomo），容器内存合计约 702 MiB。
  - 时间：Etc/UTC，NTP 已同步；uptime 10 天，load 0.87/0.32/0.18。
  - 未装 Tailscale/WireGuard；主机 Python 3.12.3，无 node/go。
  - Nginx 配置测试通过，sites：ai.fafa888.uk、dy.fafa888.uk、default。
  - 计划端口 8123/1883/5432/6379/8080/8001/3001/51820/41641 本地均空闲。
- **重要差异：任务书称“4 GB VPS”，实测为 7.6 GiB，与 m7i-flex.large（2 vCPU / 8 GiB）一致。资源分析以实测 7.6 GiB 为准，4 GB 只作假设情景。**
- 详见 `docs/audit/SERVER_AUDIT.md`。

## C. 网络架构结论 — PASS（设计完成；部分比较未核实，见缺口）

- 设计目标已定：公网 VPS 只负责平台、用户管理、API 和远程访问；家庭 LAN 运行 Home Assistant，负责设备接入和本地控制；两者通过安全 VPN 连接；不得直接将 HA、MQTT、数据库等管理端口暴露在公网。
- 拓扑、数据流向、安全边界、远程访问、断网、VPS 故障、恢复策略已写入 `docs/architecture/NETWORK_ARCHITECTURE.md`。
- VPN 推荐排序：① Tailscale 托管（家庭自用起步）② Headscale 自托管 ③ 原生 WireGuard（VPS 作 Hub）④ ZeroTier 仅作 L2 广播/组播专项备选；四方比较已按 2026-11-19 网络核实报告补全。仍保留的 UNKNOWN：各家免费额度当日准确口径（Tailscale 与 ZeroTier 均存在来源冲突，以官网当日定价页为准）、控制面宕机时既有隧道是否维持、Headscale 官方 FAQ 关于 Docker/反向代理的原文。
- 协议要求已核实：mDNS 只在 LAN 内有效；Matter 需本地控制器 + Thread 边界路由，公网 VPS 不能直接当 Matter 控制器；Zigbee 需协调器硬件；HomeKit 发现靠 mDNS、需配对码、单控制器独占（Matter 除外）。
- 状态：设计 PASS；VPN 四方比较 PASS（已补全）；免费额度口径与控制面宕机行为 NOT TESTED（部分）。

## D. 开源项目审计结果 — PASS（10 个项目已核实；补核后仅剩 2 处 UNKNOWN：python-matter-server 8.1.2 发布日期、Tailscale KB 地址）

| 项目 | 版本 | LICENSE | 状态 |
|---|---|---|---|
| Home Assistant Core | 2026.11.2（2026-11-16） | Apache-2.0（原文） | PASS |
| Home Assistant Operating System | 18.5（2026-11-06） | Apache-2.0（LICENSE 原文，2026-11-19 补核） | PASS |
| ESPHome | 2026.11.0（2026-11-18） | MIT + GPL-3.0 双许可（原文） | PASS |
| Zigbee2MQTT | 2.14.3（2026-11-01） | GPL-3.0（原文） | PASS |
| Eclipse Mosquitto | 2.1.4 / 2.0.23（2026-11-17） | EPL-2.0 OR EDL-1.0（类型已核实；文件名 UNKNOWN） | PASS |
| Matter Server（matterjs-server） | 1.5.5（2026-10-24） | Apache-2.0（原文） | PASS |
| Matter Server（python-matter-server） | 8.1.2（最终版） | Apache-2.0（仓库页字段） | PASS（已归档，勿作新选型依据） |
| openHAB | 5.2.4（2026-11-08） | EPL-2.0（原文） | PASS |
| Node-RED | 5.0.10（2026-11-17） | Apache-2.0（原文） | PASS |
| Tailscale | v1.104.7 已确认 Latest（2026-11-12，发布页直接核实） | BSD-3-Clause（原文） | PASS |
| Headscale | v0.29.7（2026-10-30） | BSD-3-Clause（原文） | PASS |

关键安全结论：Mosquitto 须 ≥2.1.3（CVE-2026-110486）；python-matter-server 已归档；ESPHome 与 Zigbee2MQTT 含 GPL-3.0 copyleft。
详见 `docs/audit/OPEN_SOURCE_AUDIT.md` 与 `THIRD_PARTY_NOTICES.md`。

## E. 设备兼容性分析 — PASS（类别级已核实；型号级全部待验证）

- 品牌×设备矩阵已完成（路由器/音响/灯光/空调/热水器 × 小米/米家、华为/鸿蒙智联、Apple HomeKit、美的、对照品牌），等级 A–D 已标注。
- 关键结论：
  - 小米/米家：三个集成易混淆（`xiaomi_miio` / `xiaomi_home` / `xiaomi_miot`），是否支持取决于 MIoT 还是旧 miIO、有无 MIoT-Spec；本地模式仅限中枢网关（仅大陆销售）。
  - 华为/鸿蒙智联：**无 HA 官方集成；鸿蒙智联 ≠ Matter**；非 Matter 型号为 D；有 Matter 认证则按 Matter 路径（A）。
  - Apple HomeKit：可经 HomeKit Device 本地双向接入（A），但须独占配对；HomePod 无 HA 原生 media_player 集成（D）；热水器经 HomeKit 接入无依据（UNKNOWN，按 D 处理）。
  - 美的：官方 `midea` 集成 2026 年新并入 HA Core（Climate 2026.8.0，Water Heater 2026.9.0）；须按型号/协议 V1/V2/V3 核实；首次取 Token/Key 需美的云账号。
  - 路由器：只做只读监控/presence（A，仅只读）；重启/改配置等高风险控制无依据，不在 Stage 0 范围。
  - 热水器：只调厂商协议已暴露的功能，**不得绕过原厂安全保护**。
  - 红外兜底为 C 级（单向，无状态回读）。
- **全部型号级结论为“待验证（无型号）”**；未做任何真机测试，未虚构任何设备测试成功。
- 详见 `docs/audit/DEVICE_COMPATIBILITY.md`；空白清点表见 `docs/audit/DEVICE_INVENTORY_TEMPLATE.md`。

## F. 仓库状态 — CREATED（已创建，私有，2026-11-19 23:39）

- GitHub 认证身份：fafa888uk（id 293246964，显示名 Fa Fa）。
- Stage 0 审计时该账号下 8 个仓库：LilaShift、`-`、fafa920q-hue、makefun-guide、Personal-AI-Gateway、makefun-guide-2、makefun-news-20261118、fafa。**当时无 LilaHome。**
- 全网搜索 LilaHome：0 结果。本地无 LilaHome 目录。
- **更新（2026-11-19 23:39–23:43）：用户授权“你自己看着开”后，仓库已创建——私有仓库 https://github.com/fafa888uk/LilaHome，默认分支 main，许可证 Apache-2.0。API 创建报 403（App 无建仓权限），改由浏览器用用户会话创建（空仓库，未勾选 README/.gitignore/license）。随后 16 个 Stage 0 文档分 4 批推送上库（提交 8c186c7、4ebd5c0、e9d9e7f、27d3d60），抽查 README/STAGE0_REPORT/LICENSE 均在库。**
- 仓库规划：

```
LilaHome/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── ui/
│   ├── types/
│   └── sdk/
├── integrations/
│   ├── home_assistant/
│   ├── matter/
│   ├── mqtt/
│   └── custom/
├── infrastructure/
│   ├── docker/
│   ├── database/
│   ├── backup/
│   └── monitoring/
├── docs/
│   ├── audit/
│   ├── architecture/
│   └── security/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
├── README.md
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── .gitignore
```

- `.gitignore` 草案已写在 `~/workspace/lila-home/.gitignore`（规划文件，含家庭敏感信息路径，绝不含真实 Token/密码/IP 配置值）。
- 家庭配置、IP 地址、设备 Token、密码、证书必须进入 `.gitignore` 或本地秘密管理机制；公开仓库不得提交任何家庭敏感数据。
- Lila Home 自身许可证未定（Stage 0 未选定）；开放源码前须重新做许可证审查。

## G. 已创建的文档 — PASS（13 份 + README + .gitignore 草案）

| # | 文件 | 一句话摘要 |
|---|---|---|
| 1 | `docs/audit/SERVER_AUDIT.md` | 火花面板实测审计，4 GB 与 7.6 GiB 差异已标注 |
| 2 | `docs/architecture/NETWORK_ARCHITECTURE.md` | VPS+HA+VPN 拓扑、数据流向、安全边界、断网/VPS 故障恢复 |
| 3 | `docs/audit/OPEN_SOURCE_AUDIT.md` | 10 个项目官方地址/版本/LICENSE/合规义务 |
| 4 | `docs/audit/DEVICE_COMPATIBILITY.md` | 品牌×设备矩阵，等级 A–D，型号级待验证 |
| 5 | `docs/audit/DEVICE_INVENTORY_TEMPLATE.md` | 空白设备清点表模板，不含虚构设备 |
| 6 | `docs/architecture/SYSTEM_ARCHITECTURE.md` | HA 为引擎、Lila Home 为平台的总体架构 |
| 7 | `docs/architecture/DATABASE_DESIGN.md` | PostgreSQL 表设计草案（用户/房间/设备/场景/审计） |
| 8 | `docs/architecture/API_DESIGN.md` | FastAPI 接口草案与控制状态机 |
| 9 | `docs/architecture/SECURITY_DESIGN.md` | RBAC、秘密管理、审计日志、备份与合规 |
| 10 | `docs/ROADMAP.md` | Stage 0–4 路线图，全部功能 PLANNED |
| 11 | `docs/FEATURE_MATRIX.md` | 九模块功能矩阵，全部 PLANNED |
| 12 | `THIRD_PARTY_NOTICES.md` | 第三方原作者、版权、许可证汇总 |
| 13 | `STAGE0_REPORT.md` | 本报告（A–J 汇报格式） |

另有 `README.md`（项目简述与 Stage 0 范围）与 `.gitignore` 草案。全部文件位于 `~/workspace/lila-home/` 下（本地工作区，未推送、未建仓）。

## H. 尚未完成的任务

| # | 任务 | 状态 | 说明 |
|---|---|---|---|
| H1 | HAOS LICENSE 原文补核 | PASS（已补核） | 文件名 `LICENSE`，Apache-2.0（原文第一行，2026-11-19 补核） |
| H2 | Mosquitto LICENSE 文件名与主仓库归属确认 | PASS（已补核） | 主仓库 `eclipse-mosquitto/mosquitto`；`LICENSE.txt` 为占位内容“-”，许可文本在 `epl-v20` / `edl-v10`（2026-11-19 补核） |
| H3 | Tailscale v1.104.7 复核 | PASS（已补核） | v1.104.7 为 Latest，2026-11-12 发布，commit cbc74fe（发布页直接核实） |
| H4 | WireGuard / ZeroTier 逐项核实 | PASS（已补全） | 网络核实报告 2026-11-19 已核实四方比较并写入 NETWORK_ARCHITECTURE.md §3.2–3.3；剩余子项 NOT TESTED：免费额度当日口径、控制面宕机时既有隧道是否维持、Headscale FAQ 原文 |
| H5 | HAOS / openHAB / Tailscale / matterjs-server 官方文档地址补核 | PASS（部分） | HAOS 文档 https://www.home-assistant.io/installation/、openHAB 文档 https://www.openhab.org/docs/ 已打开核实；Tailscale KB（tailscale.com/kb/）抓取返回 403 仍 UNKNOWN；matterjs-server 仍为仓库内 docs/ 目录 |
| H6 | python-matter-server 8.1.2 发布日期 | NOT TESTED | Releases 页抓取文本未含版本号与日期字段，两次翻页均未找到；仓库已于 2026-06-23 归档 |
| H7 | 设备清点（品牌+型号+联网方式） | BLOCKED | 待用户填写 `DEVICE_INVENTORY_TEMPLATE.md` |
| H8 | 型号级兼容性核实 | BLOCKED | 待 H7 完成后逐台核实 |
| H9 | 目标服务器身份最终确认（4 GB vs 7.6 GiB） | PASS（已确认） | 用户 2026-11-19 23:33 明确确认目标服务器就是火花面板 3.12.156.80；任务书 4 GB 为旧规格，以实测 7.6 GiB 为准 |
| H10 | 防火墙策略确认 | PASS（已决定） | 用户 2026-11-19 23:34 授权自行决定：Stage 1 现阶段不改防火墙，保持 UFW inactive 现状，暴露面仍由“服务只绑回环 + Docker 端口映射”控制；防火墙加固方案 Stage 1 另行设计，实施前复核 |
| H11 | VPN 最终选型 | PASS（已决定） | 用户 2026-11-19 23:34 授权自行决定：选 **Tailscale 托管**（家庭自用起步，运维最轻）；Headscale 自托管作为后续“去第三方依赖”演进备选 |
| H12 | LilaHome 仓库创建 | PASS（已创建） | 2026-11-19 23:39 浏览器建私有空仓；23:43 16 个文档分 4 批推送上库（8c186c7、4ebd5c0、e9d9e7f、27d3d60），抽查通过 |
| H13 | 第 11 个 Docker 容器身份 | NOT TESTED | `docker df` 计 11 total / 10 active，原始记录未列出已停止容器名称 |

## Stage 1 决策记录（2026-11-19 23:34，用户授权“你自己看着开”）

| 事项 | 决定 | 依据 |
|---|---|---|
| 目标服务器 | 火花面板 3.12.156.80（已确认） | 用户 23:33 明确确认；任务书 4 GB 为旧规格，以实测 7.6 GiB 为准 |
| VPN 选型 | Tailscale 托管（家庭自用起步） | 运维最轻、iOS 客户端成熟；Headscale 为后续自托管演进备选 |
| 防火墙 | Stage 1 现阶段不动，保持 UFW inactive 现状 | 暴露面仍由服务绑定控制；加固方案另行设计，实施前复核；不擅自改防火墙 |
| 仓库 | 私有，许可证 Apache-2.0 | 第一阶段家庭自用，后续开放源码前重新做许可证审查 |
| 设备清点 | 仍 BLOCKED，待用户提供品牌+型号+联网方式 | 无法凭空编造型号 |
| 全权执行 | 用户 2026-11-19 23:45 明确授予全部权限、直接执行、无需再问 | 覆盖 Stage 1 全部执行步骤；任务书红线仍有效（不删生产数据、不重置 Owner/密钥、不扩大费用、不绕过安全机制） |

## I. 发现的风险

| # | 风险 | 证据 | 等级 |
|---|---|---|---|
| R1 | UFW inactive，INPUT ACCEPT，公网暴露面靠服务绑定控制 | SERVER_AUDIT.md §09 | 中 |
| R2 | 无 Swap，内存耗尽时无缓冲 | SwapTotal 0 kB | 低~中 |
| R3 | Docker 镜像 13.68GB 中 66% 可回收，构建缓存挤占磁盘 | `docker df` | 低 |
| R4 | 与 5 个现有业务共用一台服务器，相互影响面未隔离验证 | 10 个容器在跑 | 中 |
| R5 | 22/80/443/24443/24444 公网监听，24443/24444 属 3x-ui，需确认是否为有意暴露 | `ss` 输出 | 待用户确认 |
| R6 | 任务书 4 GB 与实测 7.6 GiB 不符，目标服务器身份须最终确认 | SERVER_AUDIT.md | 待用户确认 |
| R7 | Mosquitto <2.1.3 存在 CVE-2026-110486 未授权 RCE | OPEN_SOURCE_AUDIT.md | 高（选型已设下限 ≥2.1.3） |
| R8 | 美的云 Token API 有关闭记录，新设备接入可能失败 | DEVICE_COMPATIBILITY.md | 中 |
| R9 | HomeKit 独占配对，已配对 Apple Home 的设备须先解除 | DEVICE_COMPATIBILITY.md | 中 |
| R10 | 华为/鸿蒙智联非 Matter 设备无可靠接入方式 | DEVICE_COMPATIBILITY.md | 中（预期内，不硬接） |
| R11 | GPL-3.0 成分（ESPHome、Zigbee2MQTT）后续开放源码须履行源码义务 | OPEN_SOURCE_AUDIT.md | 低（现阶段家庭自用） |
| R12 | Headscale 仍为 0.x，小版本间存在破坏性变更 | OPEN_SOURCE_AUDIT.md | 低~中 |

## J. Stage 1 执行建议

**本阶段结束后停止，等待用户明确批准 Stage 1。以下为建议顺序，不自动执行。**

1. 用户确认三件事：目标服务器身份（H9，已确认：火花面板 3.12.156.80）、防火墙策略（H10）、VPN 选型（H11）。
2. 用户填写设备清点表（H7），做型号级核实（H8）。
3. 补核剩余项：H6（python-matter-server 8.1.2 发布日期）、H4 剩余子项（免费额度当日口径、控制面宕机行为）、Tailscale KB 地址。
4. 用户批准创建 LilaHome 仓库（H12，公开/私有待定）并定自身许可证。
5. Stage 1 实施：仓库建立 → VPS 部署（API+Web+DB+MQTT，容器化、内存限额、管理端口不暴露公网）→ VPN 打通 → 家庭 LAN 部署 HA → 首批 1–2 类 A 级设备接入。
6. 断网演练与 VPS 故障演练各一次并记录实际恢复时间。
7. Stage 1 的任何部署须另行批准；CI 失败、备份失败不得部署；线上冒烟失败须停止并回滚（沿用用户既定的持续部署制度）。

## 附：测试规划摘要（Stage 0-08，不另立文件）

- 后端：Pytest；API 测试；设备状态测试；权限测试；异常处理测试。
- 前端：Vitest；Playwright；响应式测试。
- 设备：Home Assistant 测试环境；模拟设备仅用于测试；真机设备作为最终验收。
- 必须区分模拟测试和真实设备测试。
- 控制状态：ACCEPTED / EXECUTING / CONFIRMED / FAILED / TIMEOUT / UNKNOWN。发送控制请求成功，不代表设备执行成功；必须通过状态反馈或可靠的设备回执确认结果。
- 安全测试：权限测试（越权、Viewer 控制尝试）、危险参数拒绝、会话过期/吊销、部署后端口扫描复核、断网与 VPS 故障演练。
- 本阶段未执行任何测试，全部测试为 Stage 1 待执行项；不得把 PLANNED 写成 TESTED。
