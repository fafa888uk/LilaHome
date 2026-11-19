# Lila Home — 智能家居设备兼容性审计（Stage 0-04）

> 文档：`docs/audit/DEVICE_COMPATIBILITY.md`
> 核实基准日：2026-11-19（公开资料核实）
> 方法：`browser.search` + `browser.open` 核实 Home Assistant 官方文档（home-assistant.io/integrations/）与社区集成。
> **范围声明：目前没有具体设备型号，因此所有型号级结论必须标注“待验证（无型号）”。本文件所有 A/B/C/D 等级均为类别级可行性，不是型号级承诺。未做任何真机测试，未虚构任何设备测试成功。**

## 兼容性等级定义

| 等级 | 含义 |
|---|---|
| A | 本地双向通信，能够控制并读取真实状态 |
| B | 云端 API 控制，依赖互联网 |
| C | 红外或单向控制，无法保证真实状态反馈 |
| D | 暂时没有可靠接入方式 |

## 一、跨品牌通用协议

### Matter（官方集成）

- HA 官方 `matter` 集成，HA 自身为 Matter controller（Matter Server app/add-on），控制本地 Wi-Fi/Thread 上的 Matter 设备；通信加密；多 fabric 可共存——同一 Matter 设备可同时配对 Apple Home 与 HA（用分享码），与 HomeKit 单控制器不同。
- Thread 设备需 Thread border router（HA Connect ZBT-2 / Apple TV 4K / HomePod mini 等）；Matter-over-Wi-Fi 无需 border router；HAOS 为唯一官方支持的 Matter Server 运行方式，容器需另跑 Matter Server Docker 镜像。
- 来源：https://www.home-assistant.io/integrations/Matter/

### Thread

- 需 border router；HA 可用自有 OpenThread Border Router，也可复用 Apple/Google 的 border router，但 HA 只能配置/控制 OpenThread border router。
- 来源：https://www.home-assistant.io/integrations/Matter/ ；https://www.smarthomesensei.com/articles/does-home-assistant-support-matter-and-thread/

### Zigbee — ZHA / Zigbee2MQTT

- ZHA 为 HA 内置；Zigbee2MQTT 为独立服务，经 MQTT discovery 自动把设备加入 HA，需 Mosquitto broker + Zigbee 协调器硬件（USB/以太网）；Z2M 2.x，支持 5,400+ 设备/577 厂商（2026-06 口径，二级来源）。
- 两者均为本地、无厂商云。
- 来源：https://www.zigbee2mqtt.io/guide/usage/integrations/home_assistant.html

### HomeKit Device（官方，旧名 HomeKit Controller）

- 官方集成，把带 "Works with HomeKit" 标志的配件拉入 HA；支持以太网/Wi-Fi、蓝牙、Thread（需 Apple Thread border router）。
- **HomeKit 设备同一时间只能配对一个控制器**，已配对 Apple Home 的设备须先解除配对才能由 HA 接管（Matter 设备除外，可多 fabric 共享）。发现靠 zeroconf/mDNS，需配对码。
- 来源：https://www.home-assistant.io/integrations/homekit_controller/

### HomeKit Bridge（官方，反向）

- 把 HA 实体暴露给 Apple Home/Siri；每桥最多 150 个配件；不是把 HomeKit 设备导入 HA 的路径。
- 来源：https://www.home-assistant.io/integrations/homekit/

### MQTT / Mosquitto

- HA 官方 `mqtt` 集成；Zigbee2MQTT 与大量自定义设备经此接入；本地。
- 来源：https://www.zigbee2mqtt.io/guide/usage/integrations/home_assistant.html

### DLNA / UPnP

- 官方 `dlna_dmr` 集成，可控制 DLNA 渲染器（电视/音响），SSDP 自动发现，可手动填 `http://<IP>:49152/rootDesc.xml`；播放/暂停/音量依设备能力而异，部分设备 TTS 不工作；需 HA 与设备同 LAN，Docker 下需注意回调端口/内部 URL。
- 来源：https://www.home-assistant.io/integrations/dlna_dmr

### 红外（通用兜底）

- 官方 `broadlink` 集成（RM4 Mini/Pro 等，需先在 Broadlink app 配网 2.4 GHz Wi-Fi，HA 本地控制，学码+重放）；可再叠加 HA climate 模板做空调实体。
- **红外单向：HA 发得出，不知道设备是否真执行**，须另配功率插座/传感器才能核实真实状态。2026.4 原生 IR 的说法仅见二级评测文章，未在官方文档中核实，列为 UNKNOWN。
- 来源：https://www.home-assistant.io/integrations/broadlink/

## 二、按品牌核实

### 1. 小米 / 米家（MIoT / miIO）

三个易混淆的集成，必须按 domain 区分：

| 集成 | 性质 | 接入方式 |
|---|---|---|
| 内置 `xiaomi_miio`（UI 显示名 "Xiaomi Home"） | HA Core 官方内置 | 需设备 IP + 32 字符 token（常需 Xiaomi Cloud Tokens Extractor 获取）；支持网关、吸尘器、净化器/加湿器/风扇、空气质量仪、红外遥控（ChuangmiIr）、小米 Philips 灯、插座/排插、Mi Wi-Fi Repeater 2 设备追踪；部分配置需 YAML；有用户报告因小米侧 CAPTCHA/2FA 导致账号登录失败，修复未完全上游化。来源：https://www.home-assistant.io/integrations/xiaomi_miio/ |
| 小米官方 `xiaomi_home`（`XiaoMi/ha_xiaomi_home`） | 小米官方维护的自定义集成（HACS/Git/手动安装，非 HA Core 内置） | OAuth 2.0 登录小米账号（不存密码，但 token/证书以明文存于 HA 配置文件——二级来源提醒），选区域（cn/eu/in/ru/sg/us），走 MIoT Cloud MQTT 推送状态；本地模式仅限：小米中枢网关（固件 3.3.0_0023+）或内置中枢网关的设备（软件 0.8.9+），**中枢网关仅在中国大陆销售**；另有受限的 IP 设备 LAN 控制（文档称可能异常、不推荐）；**明确不支持蓝牙、红外、虚拟设备**。最新版 v0.5.0（2026-09-28，二级来源）。来源：https://github.com/XiaoMi/ha_xiaomi_home |
| 社区 `xiaomi_miot` / Xiaomi Miot Auto（`al-one/hass-xiaomi-miot`） | 社区 HACS 自定义集成，Apache-2.0（二级来源） | 按 MIoT-Spec 自动生成实体，支持 Wi-Fi/BLE/Zigbee 设备；可按账号导入（Automatic/Local/Cloud 三种模式）或 host+token 直连；仅 MIoT 设备可 LAN 直连，旧 miIO 设备须经小米云转换、无网不可用；最新 v1.1.5（2026-09-07/2026-10-04，不同二级来源日期略有出入），2026-10-31 仍有提交，维护中。支持的类别含 air-conditioner、water-heater、heater、bath-heater、media player（Xiaomi AI Speaker）等，见其 README 支持设备表。来源：https://github.com/al-one/hass-xiaomi-miot |
| 社区 `XiaomiGateway3`（`AlexxIT/XiaomiGateway3`） | 社区 HACS 自定义集成，MIT（二级来源） | 控制小米多模网关（Gateway 3 ZNDMWG03LM / Gateway 2 / Aqara Hub E1）原厂固件，走 LAN；暴露其下 Zigbee/BLE/Mesh 子设备；Mi Home 可同时使用；固件版本有要求（如 1.5.0–1.5.6 需 Token/Key），v4.3.0（2026-10-15，二级来源）。来源：https://github.com/AlexxIT/XiaomiGateway3 |

**关键限定：**"米家设备"≠全部支持 HA——是否支持取决于该型号走 MIoT 还是旧 miIO、有无 MIoT-Spec、是否在上述任一集成支持表内；**待验证（无型号）**。小米网关可作 Zigbee/BLE 子设备 hub，但须另购网关硬件。

### 2. 华为 / 鸿蒙智联（HarmonyOS Connect / HiLink）

- **无 HA 官方集成。** 未找到华为/鸿蒙智联官方 HA 集成、也未找到华为官方 HiLink 云 API 接入 HA 的公开文档。
- **鸿蒙智联 ≠ Matter：** HarmonyOS Connect 是华为自有生态品牌/认证体系（HiLink 协议栈、NearLink、PLC 等），与 Matter 是不同标准；只有**同时带 Matter 认证**的鸿蒙智联设备才能经 HA 官方 Matter 集成接入（须按型号核对 Matter 标志/证书，待验证（无型号））。
- 仅有的相关社区项目：`xiasi0/ha-oneconnect-bridge`——把 HA 实体**反向**暴露给华为智慧生活（HA → 华为方向），且自述为非官方、实验性，需 IPv4 组播 + UDP 5683，同一 HA 进程内一次只能配对一个父网关。**不是把华为设备导入 HA 的路径。**来源：https://reporank.net/en/repo/xiasi0-ha-oneconnect-bridge.html
- 华为手表 HA 客户端 `HA Dial`（HarmonyOS 5+ 手表，AppGallery）是**控制 HA 的终端**，不是设备接入；与本任务的设备兼容性无关。来源：https://community.home-assistant.io/t/ha-dial-home-assistant-client-for-huawei-watches-harmonyos-looking-for-feedback/1032660
- 结论：华为灯光/空调/热水器若无 Matter 认证，**目前无可靠 HA 接入方式（D）**；有 Matter 认证则按 Matter 路径（A，待验证（无型号））。

### 3. Apple HomeKit（作为设备来源）

- 见第 1 节 HomeKit Device / Bridge。HomeKit 灯光、空调（thermostat 类）、插座等若未配对其他控制器，可经 HomeKit Device 本地双向接入（A，待验证（无型号））；**HomeKit 设备 ≠ 全部可导入 HA**：已配对 Apple Home 的须先解除；部分厂商 HomeKit 实现不完整、或需厂商 hub/账号先行配网；iPhone/iPad 有时是无 UI 的 Wi-Fi 配件入网所必需。
- **HomePod / HomePod mini：无 HA 原生 media_player 集成。** HA 官方文档只把 HomePod（2nd gen）/HomePod mini 列为 Thread border router。音频控制仅有非官方路径：经 Apple TV 集成作为 AirPlay 目标出现、部分人可得 TTS，但二级来源明确称该路径非官方、曾随 HomePod OS 更新失效，不建议作为公告依赖；另有 HACS 社区 `airplay_speakers`（仅音量+TTS，AirPlay 1/2 发现靠 mDNS，无播放控制）。
- **Apple TV：官方集成**（`apple_tv`，pyatv），本地自动发现，含 media_player + remote + 键盘 binary_sensor；AirPlay 与 HomeKit 访问须设为"同一网络上的所有人"。来源：https://next.home-assistant.io/integrations/apple_tv/
- **热水器：** HomeKit 标准配件类别中无通用热水器类别，未找到经 HomeKit 接入热水器的公开依据——UNKNOWN，暂按 D 处理，须按型号核实。

### 4. 美的（Midea / M-Smart）

| 集成 | 性质 | 接入方式 |
|---|---|---|
| HA Core 官方 `midea` 集成 | **2026 年新并入 HA Core**：Climate 自 2026.8.0，Water Heater 自 2026.9.0 起分平台迁移（社区公告，迁移进行中）；官方文档称直接走本地网络控制 M-Smart 协议设备（含贴牌品牌），全部控制与状态更新均在本地；支持协议 V1/V2/V3；支持设备类型含空调、电热水器、燃气热水器、热泵热水器、电暖器等。来源：https://www.home-assistant.io/integrations/midea | 本地控制 |
| 社区 `midea_ac_lan`（`wuwentao/midea_ac_lan`，原 `georgezhao2010/midea_ac_lan` 的维护 fork） | HACS 自定义集成，MIT（二级来源），最新 v2026.10.0（2026-10-23，二级来源） | 局域网自动发现+UI 配置；日常控制/状态走 LAN 长 TCP 连接，不走云；**但首次取 Token/Key 需用美的云账号登录**（美居/SmartHome 云 Token API；NetHome Plus 目前取不到 Token）；且设备内置 Wi-Fi 模块设计上会持续尝试连接美的云，断网时模块会反复重启探测。支持类型表含 AC、E2 电热水器、E3 燃气热水器、CD 热泵热水器等，须按文档逐类型确认功能。来源：https://github.com/wuwentao/midea_ac_lan |
| 社区 `midea-ac-py` / Midea Smart AC（`mill1000/midea-ac-py`） | HACS 自定义集成 | 仅空调（type 0xAC/0xCC），LAN 控制；新设备取 token/key 可能需自有账号经 msmart-ng CLI。来源：https://raw.githubusercontent.com/mill1000/midea-ac-py/main/README.md |

**关键限定：** 美的须按型号/协议区分——M-Smart Wi-Fi 机型 vs 蓝牙/红外/非智能老机型 vs 美的不同子品牌（COLMO、华凌、小天鹅等贴牌机）支持度不同；**待验证（无型号）**。热水器只能调目标温度/模式/开关等厂商协议已暴露的功能，**不得绕过原厂安全保护**（超温、燃气、干烧等联锁不在 HA 控制面内，公开资料未提供任何绕过方法，本研究亦不提供）。

### 5. 其他对照品牌

| 品牌 | 官方集成 | 协议/要点 | 来源 |
|---|---|---|---|
| 飞利浦 Hue | 官方 `hue`，Local Push（V2 方形桥） | HA 经 LAN 与 Hue Bridge 通信，V2 桥用本地事件流即时推送状态；需 Hue Bridge（V2 50 灯/12 配件，Bridge Pro 150+ 灯）；按桥上物理键配对授权；也可不用桥、把灯泡直连 ZHA/Zigbee2MQTT（丢 Hue 场景/Entertainment/固件更新）。 | https://rc.home-assistant.io/integrations/hue/ |
| Yeelight（小米生态） | 官方 `yeelight`，Local Push | 须在 Yeelight app 内逐台开启 "LAN Control"（TCP 55443），建议固定 IP；自动发现（zeroconf/DHCP），支持亮度/色温/颜色/夜灯传感器；Yeelight Pro 网关类须另用社区 `hasscc/yeelight-pro`。新款 Matter 灯另可走 Matter。 | https://www.home-assistant.io/integrations/yeelight |
| Aqara | 无独立账号登录式集成；HA 有 Aqara 品牌页（Works with HA，Matter 认证） | 三条路：① 原生 Matter 设备/经 M3 等 hub 作 Matter bridge 共享给 HA；② 直连 ZHA/Zigbee2MQTT（绝大多数 Zigbee 传感器/开关，无需 Aqara hub，本地）；③ FP2 等 Wi-Fi 款经 HomeKit Controller。认证清单只是 Aqara 产品一小部分。 | https://privatehomelab.com/aqara-home-assistant-native-integration-explained/ |
| Sonos（音响对照） | 官方 `sonos`，Local Push | 本地控制，分组/队列/音量/TTS；Sonos 账号只在初始配网时需要。 | https://www.home-assistant.io/integrations/sonos |

## 三、品牌 × 设备矩阵

全部型号级结论：**待验证（无型号）**。

### 路由器（只区分只读监控 vs 高风险控制）

| 品牌 | 发现 | 读状态 | 执行控制 | 局域网 | 依赖云 | 需网关 | 需账号授权 | 真实结果反馈 | 等级+依据 |
|---|---|---|---|---|---|---|---|---|---|
| 小米 | 部分（legacy `xiaomi` device_tracker 平台，查 `http://<IP>/api/misystem/devicelist` 或 luci 路径验证；Mi Wi-Fi Repeater 2 经 `xiaomi_miio` device_tracker，需 token） | 是（在线客户端列表/presence） | 否——公开资料仅为 presence detection，无重启/改配置/限速等控制面 | 是 | 否 | 否 | 是（路由器管理密码/token） | 是（客户端在线状态即反馈，但有延迟） | **A（仅只读监控/presence）**——控制面无依据，任何重启/改配置操作均属高风险、须另行核实，不得默认可用。来源：https://rc.home-assistant.io/integrations/xiaomi/ ；https://www.home-assistant.io/integrations/xiaomi_miio/ |
| 华为 | 是（`huawei_lte` 官方集成，SSDP 发现；另有 legacy `huawei_router` device_tracker，仅实测 HG8247H/HG8247Q） | 是（信号/流量/WAN IP/短信计数/在线客户端） | 有限（`huawei_lte` 含移动数据、访客 Wi-Fi 开关等，依型号/固件而异；家用非 LTE 路由器控制面 UNKNOWN） | 是 | 否 | 否 | 是（路由器凭据） | 是（传感器/开关状态） | **A（仅只读监控+个别开关，限 LTE 机型）**；家用华为路由器（非 LTE）**待验证（无型号）**，高风险控制无依据。来源：https://www.home-assistant.io/integrations/huawei_lte/ |
| 其他（OpenWrt/ASUSWRT/UniFi） | 是 | 是 | 仅 presence/个别开关，路由器配置控制无通用依据 | 是 | 否 | 否（UniFi 需本地控制器） | 是 | 是 | **A（仅只读监控/presence）**。来源：https://www.home-assistant.io/integrations/ubus |
| 通用兜底 | Ping / Nmap Tracker | 是（在线与否） | 否 | 是 | 否 | 否 | 否 | 有限 | **A（仅只读）** |

### 智能音响

| 品牌 | 发现 | 读状态 | 执行控制 | 局域网 | 依赖云 | 需网关 | 需账号授权 | 真实结果反馈 | 等级+依据 |
|---|---|---|---|---|---|---|---|---|---|
| 小米小爱音箱 | 经 Miot 发现（账号导入或 host/token） | 有限（`xiaomi_miot` 提供 media player 实体，见其支持表） | 有限（播放/TTS/播报类操作依型号，语音助手本身仍走小米云） | 部分（LAN 模式仅 MIoT 设备；语音识别/音乐服务依赖云） | 是（小爱语音、音乐） | 否（但 Zigbee/BLE 子设备需网关） | 是（小米账号） | 部分 | **B**——可作 HA media_player 下行播报/播放，但"小爱语音控制 HA 设备"是反向（经 Bemfa 云平台同步实体到米家，第三方云桥接），非 HA 直控音箱。**待验证（无型号）**。来源：https://github.com/al-one/hass-xiaomi-miot |
| 华为 Sound 系列 | 无 HA 集成发现 | UNKNOWN（无 HA 实体） | 无直接 HA 控制；仅 DLNA/QPlay/蓝牙/AUX 物理路径 | DLNA 可本地 | 语音/智慧生活功能依赖华为云 | 否 | 否（DLNA）/是（智慧生活） | DLNA 播放状态依设备 | **C/D**——DLNA 通用渲染器可播音频（C 级，状态反馈弱）；作为智能音箱的语音/场景控制**无可靠 HA 方式（D）**。**待验证（无型号）**。来源：https://www.home-assistant.io/integrations/dlna_dmr |
| Apple HomePod/mini | 无 HA 媒体集成发现；仅作 Thread border router 被 HA Thread 集成识别 | 否（无 media_player 实体） | 否（无官方播放/音量控制） | AirPlay 本地传输，但控制面非官方 | 是（Siri/Apple Music） | 否 | 是（Apple ID 配网） | 否 | **D**——无直接 HA media_player 集成；AirPlay 非官方路径脆弱，不可作为依赖 |
| 其他对照 Sonos | 自动发现（SSDP） | 是 | 是（播放/暂停/音量/分组/队列/TTS） | 是 | 否（控制面；流媒体本身依赖其云） | 否 | 初始配网需 Sonos 账号 | 是 | **A**——官方 Local Push 集成 |

### 智能灯光

| 品牌 | 发现 | 读状态 | 执行控制 | 局域网 | 依赖云 | 需网关 | 需账号授权 | 真实结果反馈 | 等级+依据 |
|---|---|---|---|---|---|---|---|---|---|
| 小米/米家 | 是（账号导入/MIoT-Spec/网关子设备） | 是（开关/亮度/色温/颜色，依 MIoT-Spec） | 是 | 有条件（MIoT 设备可 LAN；miIO 老设备须云；无中枢网关时 Zigbee/BLE 子设备走云） | 有条件 | 有条件（Zigbee/BLE 灯需小米/Aqara 网关或 ZHA/Z2M 协调器） | 是（小米账号/OAuth；LAN 直连另需 token） | 是（云 MQTT 推送或 LAN 推送，依路径） | **A（有条件）/B**——MIoT Wi-Fi 灯 + LAN 模式为 A；其余为 B；**待验证（无型号）** |
| 华为/鸿蒙智联 | 仅 Matter 认证灯可被 HA Matter 发现 | 是（若 Matter） | 是（若 Matter） | 是（若 Matter） | 否（若 Matter） | Thread 灯需 border router | 否（Matter 配对码） | 是 | **A（仅限 Matter 认证型号）**；非 Matter 鸿蒙智联灯 **D**。**待验证（无型号）** |
| Apple HomeKit 灯 | 是（HomeKit Device 自动发现，需配对码） | 是 | 是 | 是 | 否 | Thread 灯需 border router；部分需厂商 hub 先配网 | 否（配对码，非 Apple ID） | 是 | **A**——本地双向，但须独占配对（单控制器限制）。**待验证（无型号）** |
| 美的灯 | UNKNOWN——未找到美的照明经 Midea/M-Smart 接入 HA 的公开依据 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **D/UNKNOWN**——须按型号核实是否属 M-Smart 或 Matter |
| 对照 Hue | 是（桥自动发现） | 是（V2 桥本地推送） | 是 | 是 | 否（控制面） | 是（Hue Bridge） | 否（桥物理键授权） | 是 | **A** |
| 对照 Yeelight | 是（zeroconf/DHCP） | 是（Local Push） | 是 | 是（须先开 LAN Control） | 否 | 否 | 否 | 是 | **A** |
| 对照 Aqara | 是（Matter/ZHA/Z2M） | 是 | 是 | 是 | 否 | Matter bridge 或 Zigbee 协调器（二选一，按型号） | 否 | 是 | **A** |

### 空调

| 品牌 | 发现 | 读状态 | 执行控制 | 局域网 | 依赖云 | 需网关 | 需账号授权 | 真实结果反馈 | 等级+依据 |
|---|---|---|---|---|---|---|---|---|---|
| 小米/米家 | 是（Miot climate 实体：air-conditioner 服务，on/mode/target-temperature 等） | 是 | 是（开关/模式/目标温度/风速/摆风，依 MIoT-Spec） | 有条件（同灯光） | 有条件 | 有条件 | 是 | 是（依路径推送） | **A（有条件）/B**；红外空调伴侣（ir-aircondition-control）另见 C。**待验证（无型号）** |
| 华为/鸿蒙智联 | 仅 Matter thermostat 类可发现 | 是（若 Matter） | 是（若 Matter） | 是 | 否 | Thread 需 border router | 否 | 是 | **A（仅限 Matter 认证型号）**；否则 **D**。**待验证（无型号）** |
| Apple HomeKit 空调 | 是（HomeKit Device，thermostat 类） | 是 | 是 | 是 | 否 | 依型号 | 否（配对码） | 是 | **A**（独占配对限制同上）。**待验证（无型号）** |
| 美的 | 是（Core `midea` / `midea_ac_lan` 自动发现） | 是（长 TCP 连接实时同步） | 是（climate 实体） | 是（日常控制） | 首次取 Token/Key 需云；Wi-Fi 模块会持续探云 | 否 | 是（首次取 Token 需美的账号） | 是 | **A（有条件）**——本地双向，但新设备接入依赖云 Token API 且该 API 有被关闭的记录，须按型号/协议（V1/V2/V3）核实。**待验证（无型号）** |
| 通用兜底（任何品牌红外空调） | Broadlink 官方集成发现 | 否（无状态回读） | 是（学码重放） | 是 | 否 | 否（需另购 Broadlink RM4 等红外发射器） | 否 | 否 | **C**——单向红外，HA 显示的状态只是"最后发送的指令"，须另配传感器/功率插座核实 |

### 热水器

| 品牌 | 发现 | 读状态 | 执行控制 | 局域网 | 依赖云 | 需网关 | 需账号授权 | 真实结果反馈 | 等级+依据 |
|---|---|---|---|---|---|---|---|---|---|
| 小米/米家 | 是（Miot water-heater 服务 → HA `water_heater` 实体） | 是（温度/模式，依 MIoT-Spec） | 是（开关/目标温度/模式，依 MIoT-Spec） | 有条件（同上） | 有条件 | 有条件 | 是 | 是（依路径） | **A（有条件）/B**；仅限协议已暴露的功能，安全联锁不在 HA 控制面。**待验证（无型号）** |
| 华为/鸿蒙智联 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **D/UNKNOWN**——未找到鸿蒙智联热水器接入 HA 的公开依据；仅 Matter 认证热水器（若存在）可走 Matter，须按型号核实 |
| Apple HomeKit | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **D/UNKNOWN**——未找到经 HomeKit 接入热水器的公开依据 |
| 美的 | 是（Core `midea` Water Heater 平台自 2026.9.0；`midea_ac_lan` 类型 E2 电热水器/E3 燃气热水器/CD 热泵热水器） | 是（目标水温、火焰燃烧状态、零冷水循环等，依型号） | 是（目标温度/模式/开关等，须先在美的 app 确认该机支持该功能再启用） | 是（日常控制） | 首次取 Token/Key 需云 | 否 | 是（首次取 Token 需美的账号） | 是 | **A（有条件）**——本地双向，但须按型号/协议逐项核实；燃气热水器只调协议内功能，**不得绕过原厂安全保护**。**待验证（无型号）**。来源：https://www.home-assistant.io/integrations/midea ；https://github.com/wuwentao/midea_ac_lan |

## 四、需向用户确认 / 待验证清单（未核实，不得默认）

1. 全部五类设备的**具体品牌+型号+固件/联网方式**（Wi-Fi/Zigbee/BLE/红外/Matter），否则以上所有 A/B 均只是"类别级可行性"，型号级一律待验证。
2. 小米设备所在区域（cn/eu 等）及是否有小米中枢网关（仅大陆销售）——决定能否真正本地化。
3. 华为设备是否有 Matter 认证标志/证书（决定是 A 还是 D）。
4. 美的设备是否为 M-Smart Wi-Fi 机型、协议版本（V1/V2/V3）及能否取得 Token/Key（云 Token API 有关闭记录）。
5. 路由器具体型号与固件，以及是否接受"只读监控、路由器配置/重启等高风险控制不在 Stage 0 范围内"。
6. 热水器燃气/电/热泵类型与型号——安全联锁范围须以厂商文档为准，HA 只做协议内控制。
7. 音响的具体型号与期望：仅播报/TTS，还是要语音助手反向控制 HA 设备（后者走云桥接，与前者完全不同）。

## 五、主要来源 URL

- https://www.home-assistant.io/integrations/xiaomi_miio/
- https://github.com/XiaoMi/ha_xiaomi_home
- https://github.com/al-one/hass-xiaomi-miot
- https://github.com/AlexxIT/XiaomiGateway3
- https://www.home-assistant.io/integrations/homekit_controller/
- https://www.home-assistant.io/integrations/homekit/
- https://www.home-assistant.io/integrations/Matter/
- https://www.home-assistant.io/integrations/midea
- https://github.com/wuwentao/midea_ac_lan
- https://raw.githubusercontent.com/wuwentao/midea_ac_lan/master/README.md
- https://raw.githubusercontent.com/mill1000/midea-ac-py/main/README.md
- https://rc.home-assistant.io/integrations/hue/
- https://www.home-assistant.io/integrations/yeelight
- https://www.home-assistant.io/integrations/dlna_dmr
- https://next.home-assistant.io/integrations/apple_tv/
- https://www.home-assistant.io/integrations/huawei_lte/
- https://www.home-assistant.io/integrations/ubus
- https://rc.home-assistant.io/integrations/xiaomi/
- https://www.zigbee2mqtt.io/guide/usage/integrations/home_assistant.html
- https://privatehomelab.com/xiaomi-home-assistant-official-integration-local-mode-reality/
- https://privatehomelab.com/aqara-home-assistant-native-integration-explained/
- https://community.home-assistant.io/t/midea-formerly-midea-ac-lan-integration-is-now-part-of-home-assistant-core/1022097
- https://community.home-assistant.io/t/making-sure-i-have-this-right-homekit-home-assistant-sharing-matters-device/938423
- https://community.home-assistant.io/t/xiaomi-home-integration-to-ha/930629
- https://reporank.net/en/repo/xiasi0-ha-oneconnect-bridge.html
- https://www.home-assistant.io/integrations/broadlink/
- https://www.home-assistant.io/integrations/sonos
