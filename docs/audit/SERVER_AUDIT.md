# Lila Home — 服务器环境审计（Stage 0-01）

> 文档：`docs/audit/SERVER_AUDIT.md`
> 审计日期：2026-11-19（服务器时间 2026-11-19T15:23:20+00:00）
> 审计方式：只读审计，未修改任何服务器配置、未安装任何软件、未重启/停止任何服务
> 原始记录：`hidden_files/server_audit_raw_2026-11-19.txt`（本文件所有数字均逐项引用该原始记录，未改写）
> 审计目标：火花面板，公网 IP 3.12.156.80（用户 2026-11-19 明确指定该服务器做只读审计）

## 0. 结论先行

| 项目 | 结论 |
|---|---|
| 审计是否完成 | 已完成只读审计（PASS，有原始记录为证） |
| 操作系统 | Ubuntu 24.04.5 LTS，内核 7.0.0-1014-aws |
| CPU | Intel Xeon Platinum 8488C，2 vCPU |
| 内存 | **实测 7.6 GiB（MemTotal 7962852 kB），无 Swap** |
| 磁盘 | nvme0n1 60G，`/` ext4 58G，已用 18G，剩余 40G（32%） |
| Docker | 29.1.3，10 个容器在跑，内存合计约 702 MiB |
| 防火墙 | UFW inactive；iptables INPUT 策略 ACCEPT |
| 计划端口 | 8123 / 1883 / 5432 / 6379 / 8080 / 8001 / 3001 / 51820 / 41641 本地均空闲 |
| Tailscale / WireGuard | 未安装（`tailscale` 命令不存在） |
| **重要差异** | **任务书称“4 GB VPS”，实测为 7.6 GiB，与 m7i-flex.large（2 vCPU / 8 GiB）一致。资源分析以实测 7.6 GiB 为准，4 GB 只作假设情景。** |

## 1. 信息来源分类

本报告严格区分四类信息，禁止把未检测项目写成已完成。

### 1.1 已经实际检测的信息

本节全部内容来自 2026-11-19 只读审计原始记录（`hidden_files/server_audit_raw_2026-11-19.txt`）。

#### 操作系统与内核

- Distributor ID：Ubuntu；Description：Ubuntu 24.04.5 LTS；Release：24.04；Codename：noble
- `PRETTY_NAME="Ubuntu 24.04.5 LTS"`；`VERSION_ID="24.04"`；`VERSION="24.04.5 LTS (Noble Numbat)"`
- 内核：`Linux ip-172-31-18-252 7.0.0-1014-aws #14~24.04.1-Ubuntu SMP PREEMPT Fri Sep 18 21:24:59 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux`
- 主机名：`ip-172-31-18-252`

#### CPU

- 型号：Intel(R) Xeon(R) Platinum 8488C
- `lscpu`：Architecture x86_64；CPU(s) 2；Thread(s) per core 2；Core(s) per socket 1；Socket(s) 1
- `/proc/cpuinfo` 中 `model name` 出现 2 次，与 2 vCPU 一致

#### 内存与 Swap

- `free` 输出：Mem total 7.6Gi，used 1.4Gi，free 530Mi，shared 25Mi，buff/cache 6.0Gi，available 6.2Gi
- `MemTotal: 7962852 kB`；`MemFree: 542740 kB`；`MemAvailable: 6456144 kB`
- Swap：`Swap: 0B 0B 0B`；`SwapTotal: 0 kB`；`SwapFree: 0 kB`——**无 Swap，未配置交换空间**

#### 磁盘与文件系统

| 文件系统 | 类型 | 大小 | 已用 | 可用 | 使用率 | 挂载点 |
|---|---|---|---|---|---|---|
| /dev/root | ext4 | 58G | 18G | 40G | 32% | / |
| /dev/nvme0n1p16 | ext4 | 881M | 203M | 617M | 25% | /boot |
| /dev/nvme0n1p15 | vfat | 105M | 6.2M | 99M | 6% | /boot/efi |
| tmpfs | tmpfs | 3.8G | 0 | 3.8G | 0% | /dev/shm |
| tmpfs | tmpfs | 1.6G | 2.1M | 1.6G | 1% | /run |

- `lsblk`：nvme0n1 60G disk；nvme0n1p1 59G part ext4 `/`；nvme0n1p14 4M；nvme0n1p15 106M vfat /boot/efi；nvme0n1p16 913M ext4 /boot；另有 5 个 snap loop 设备（amazon-ssm-agent、core22、snapd）
- Docker 磁盘占用（`docker df`）：Images 17 个，13.68GB，可回收 9.073GB（66%）；Containers 11 个（10 active），2.396MB；Local Volumes 5 个，101.2MB；Build Cache 54 个，5.113GB，可回收 218.8MB

#### 网络接口与路由

- `lo`：127.0.0.1/8，::1/128
- `enp39s0`：UP，172.31.18.252/20，fe80::4ff:dfff:fed9:4b7/64
- `docker0`：DOWN，172.17.0.1/16
- Docker 网桥：br-0263f6347489 172.18.0.1/16；br-6240c5af1d58 172.19.0.1/16；br-51a189790d7b 172.20.0.1/16；br-bf69f8ee58d4 172.21.0.1/16；br-226ff3d06bad 172.22.0.1/16（均为 UP）
- 默认路由：`default via 172.31.16.1 dev enp39s0 proto dhcp src 172.31.18.252 metric 100`
- 内网段：172.31.16.0/20 dev enp39s0

#### 运行服务（27 个 loaded units）

`systemctl list-units --type=service --state=running` 列出 27 个单元，全部 active running：

acpid、chrony（NTP）、containerd、cron、dbus、docker、getty@tty1、irqbalance、ModemManager、multipathd、networkd-dispatcher、nginx、polkit、rsyslog、serial-getty@ttyS0、shadowsocks-libev、snap.amazon-ssm-agent.amazon-ssm-agent、snapd、ssh（OpenBSD Secure Shell server）、systemd-journald、systemd-logind、systemd-networkd、systemd-resolved、systemd-udevd、udisks2、unattended-upgrades、user@1000。

注意：本审计未逐项核查各服务的配置文件与监听细节；服务清单只证明“在跑”，不证明“配置正确”。

#### 开放端口（`ss`，无 sudo，未显示进程名）

公网监听（0.0.0.0 / [::]）：

| 端口 | 协议 | 说明（按原始记录，进程名未显示，归属为推断，见 1.4） |
|---|---|---|
| 80 | TCP | nginx（HTTP） |
| 443 | TCP | nginx（HTTPS） |
| 22 | TCP | ssh |
| 24443 | TCP | 3x-ui 面板容器端口映射 |
| 24444 | TCP + UDP | 3x-ui 面板容器端口映射 |

仅回环监听（127.0.0.1 / 127.0.0.53 / 127.0.0.54 / ::1）：3000、8000、18080、8787、8788、7890、9090、2053、39839、8388、53（systemd-resolved）。

说明：其余业务端口只绑 127.0.0.1，未直接暴露公网；这是现有部署较好的做法，Lila Home 必须沿用（见 `docs/architecture/SECURITY_DESIGN.md`）。

#### 防火墙状态

- UFW：`Status: inactive`
- iptables：Chain INPUT policy ACCEPT（空规则）；Chain OUTPUT policy ACCEPT（空规则）；Chain FORWARD policy DROP，含 DOCKER-USER 与 DOCKER-FORWARD 跳转；Chain DOCKER 有 5 个引用，含对 172.22.0.4:3000、172.22.0.3:8000、172.21.0.6:8080、172.21.0.3:8787、172.20.0.2:24444/24443/2053、172.21.0.5:6080、172.21.0.2:9090/7890 的 ACCEPT，以及多条 DROP。

风险提示（事实陈述，非改动建议）：UFW 未启用，INPUT 策略为 ACCEPT，公网暴露面实际由“服务只绑回环 + Docker 端口映射”控制，而非主机防火墙规则。Stage 1 部署前须由用户单独批准防火墙方案，本阶段不作任何修改。

#### Docker 环境

- Docker 版本：29.1.3，build 29.1.3-0ubuntu3~24.04.2
- 非 sudo 执行 `docker ps` 被拒绝：`permission denied while trying to connect to the docker API at unix:///var/run/docker.sock`（该用户无 docker 组权限，属实测现象，不作推断）
- `sudo docker ps` 结果：10 个容器在跑（`docker df` 另计 Containers 11 total / 10 active，差 1 个为已停止容器，原始记录未列出其名称，见 1.3）

| 容器 | 镜像 | 状态 | 端口映射 |
|---|---|---|---|
| infra-web-1 | ghcr.io/fafa920q-hue/personal-ai-gateway-web:0.1.5 | Up 4 days (healthy) | 127.0.0.1:3000->3000/tcp |
| infra-api-1 | ghcr.io/fafa920q-hue/personal-ai-gateway-api:0.1.5 | Up 4 days (healthy) | 127.0.0.1:8000->8000/tcp |
| infra-db-1 | postgres:16-alpine | Up 4 days (healthy) | 5432/tcp（未映射到主机） |
| dy-portal-web-1 | dy-portal:0.2.2 | Up 9 days (healthy) | 127.0.0.1:18080->8080/tcp |
| dy-portal-scheduler-1 | dy-portal:0.2.2 | Up 9 days (healthy) | 8080/tcp（未映射到主机） |
| douyin-web | douyin-sparkflow:local | Up 9 days | 127.0.0.1:8787->8787/tcp |
| dy-family-network-xui-1 | 1628adbd9bed | Up 9 days | 127.0.0.1:2053->2053/tcp，0.0.0.0:24443-24444->24443-24444/tcp，0.0.0.0:24444->24444/udp |
| login-desktop | douyin-sparkflow:local | Up 9 days | 127.0.0.1:8788->6080/tcp |
| douyin-scheduler | douyin-sparkflow:local | Up 9 days | （无映射） |
| mihomo | metacubex/mihomo:latest | Up 9 days | 127.0.0.1:7890->7890/tcp，127.0.0.1:9090->9090/tcp |

容器内存占用（`docker stats`，审计瞬间值）：infra-web-1 151.4MiB；infra-api-1 83.05MiB；infra-db-1 22.47MiB；dy-portal-web-1 46.11MiB（限 384MiB）；dy-portal-scheduler-1 17.25MiB（限 384MiB）；douyin-web 74.75MiB；dy-family-network-xui-1 104.7MiB（限 512MiB）；login-desktop 166.5MiB（限 1.172GiB）；douyin-scheduler 28.43MiB；mihomo 7.582MiB。**合计约 702 MiB。** CPU 占用审计瞬间均低于 1%。

#### 系统时间与运行状态

- 时间：2026-11-19T15:23:20+00:00；Local time 与 Universal time 均为 Thu 2026-11-19 15:23:20 UTC；RTC time 15:23:19
- 时区：Etc/UTC (UTC, +0000)；System clock synchronized: yes；NTP service: active；RTC in local TZ: no
- Uptime：`15:23:20 up 10 days, 1:50, 2 users, load average: 0.87, 0.32, 0.18`
- 语言运行时（主机）：Python 3.12.3；`node: command not found`；`go: command not found`（主机无 Node.js / Go，容器内情况未检测）
- Tailscale / WireGuard：`tailscale: command not found`；`/usr/bin/*wire*` 不存在；`/usr/bin/tailscale` 不存在——**未安装**
- Nginx：`nginx: configuration file /etc/nginx/nginx.conf syntax is ok`；`test is successful`；sites：ai.fafa888.uk、dy.fafa888.uk、default
- AWS 元数据查询：原始记录中 `=== AWS META ===` 后无输出（未返回数据，不作推断）

#### Lila Home 计划端口占用检查

审计时本地均空闲：8123、1883、5432、6379、8080、8001、3001、51820、41641。注意：5432 在容器内被 infra-db-1 占用（未映射到主机），主机端口 5432 本身空闲；若 Lila Home 另起 PostgreSQL，须用独立容器/独立数据卷，不得复用 infra-db-1。

### 1.2 用户提供的信息

- 项目名称 Lila Home（紫序智能家居控制中心），目标品牌与设备清单见任务书（小米/米家、华为/鸿蒙智联、Apple HomeKit、美的等；路由器、音响、灯光、空调、热水器）。
- 服务器类型“Linux VPS / 云服务器，Ubuntu，内存 4 GB”——**与实测 7.6 GiB 不符，以实测为准**（见第 0 节与第 2 节）。
- GitHub 仓库名 LilaHome（状态见 1.3 与 `STAGE0_REPORT.md`：不存在，未创建）。
- 服务器位于公网，家庭使用独立路由器（家庭 LAN 拓扑、路由器型号、内网段均未提供，见 1.3）。

### 1.3 尚未获取的信息

- 家庭局域网拓扑：路由器品牌/型号/固件、内网网段、是否有现成 Home Assistant 主机、Zigbee/Thread 协调器硬件——全部未提供、未检测。
- 具体设备清单：五类设备的品牌、型号、固件版本、联网方式（Wi-Fi / Zigbee / BLE / 红外 / Matter）——全部未提供（见 `docs/audit/DEVICE_INVENTORY_TEMPLATE.md`）。
- 第 11 个 Docker 容器（`docker df` 计 11 total / 10 active）的名称与状态——原始记录未列出。
- 各监听端口对应的进程名——`ss` 无 sudo 未显示进程名，未逐一核对。
- 各现有业务（Personal AI Gateway、dy-portal、douyin-sparkflow、3x-ui、mihomo）的配置细节、数据卷位置、备份状态——未检测（只读审计范围外，且与 Lila Home 无直接关系）。
- AWS 元数据（实例类型、区域等）——查询无输出，未确认。

### 1.4 需要进一步确认的信息

- 4 GB 与 7.6 GiB 的差异原因已确认：用户 2026-11-19 23:33 明确确认目标服务器就是火花面板 3.12.156.80，任务书的 4 GB 为旧规格，以实测 7.6 GiB 为准；资源分析按 7.6 GiB 执行。
- UFW inactive + INPUT ACCEPT 是否为有意配置？Stage 1 前须用户确认防火墙策略，本阶段不改。
- 是否允许 Lila Home 与现有业务共用同一台服务器（共用 Docker、共用 Nginx、共用 5432 以外的端口）？共用方案须通过 Stage 1 的隔离设计评审。
- 时区保持 Etc/UTC 还是改为 Asia/Shanghai？本阶段不改，只记录现状。
- Swap 为 0：是否接受无 Swap 运行数据库与 Home Assistant？建议 Stage 1 部署前评估（加 Swap 或配内存限额），须用户批准后才做。

## 2. 资源分析：实测 7.6 GiB 是否够用

### 2.1 以实测为准的结论

- 当前已用内存 1.4 Gi，可用 6.2 Gi；10 个现有容器合计约 702 MiB；磁盘剩余 40G。**在“与现有业务共存、不独占服务器”的前提下，Lila Home 可以部署，但必须轻量化、必须设内存限额、不得无限制同时全开所有组件。**
- 现有业务本身已占约 702 MiB 容器内存 + 主机服务开销；Lila Home 新增组件的内存预算建议控制在可用内存之内，并以实测为准逐步放量，不得一次全开。

### 2.2 组件逐项判断（PLANNED，未部署）

| 组件 | 部署建议 | 依据 |
|---|---|---|
| React 前端（静态构建） | 可部署；构建产物由 Nginx 静态托管，不常驻大内存 | 静态站点本身不占运行内存；构建在 CI/本地做，不在服务器上常驻 Node |
| FastAPI 后端 | 可部署；单进程 + 内存限额 | Python 3.12.3 主机已有；容器化部署，与现有 infra-api 隔离 |
| PostgreSQL | 可部署，但须独立实例/独立数据卷，不得复用 infra-db-1（postgres:16-alpine 已在跑） | 现有 infra-db-1 审计瞬间仅 22.47 MiB，但那是另一业务的数据库；Lila Home 的库须独立命名、独立卷、独立备份 |
| MQTT（Mosquitto） | 可部署；轻量 | Mosquitto 本身轻量；但须用 ≥2.1.3（CVE-2026-110486，见 `OPEN_SOURCE_AUDIT.md`） |
| Redis | 按需，不是强制依赖；初期可不部署，用 PostgreSQL + 内存缓存代替 | 任务书已明确 Redis 按需；4 GB 假设情景下更应后置 |
| 反向代理 | 复用现有 Nginx，不另起 | Nginx 已在跑且配置测试通过；Lila Home 只加 server 块，须用户批准后才改 |
| 监控系统 | 轻量优先；初期只做容器健康检查 + 日志，不上重型监控栈 | 重型监控（Prometheus + Grafana 全套）在共存场景下性价比低，Stage 1 再评估 |

### 2.3 4 GB 假设情景（任务书原规格，仅作对照）

若目标真是 4 GB VPS：React + FastAPI + PostgreSQL + Mosquitto 可以共存，但 Redis 与重型监控必须后置，PostgreSQL 与各容器必须设硬性内存限额，且须预留 Swap 或接受 OOM 风险。**该情景未经实测，仅为假设，不得作为部署依据。**

### 2.4 轻量化部署建议（Stage 1 参考，不执行）

1. 全部组件容器化，一个 `docker-compose.yml`，每个服务设 `mem_limit`。
2. 前端静态化，不跑 Node 服务；后端单 worker 起步。
3. PostgreSQL 与 Mosquitto 先行，Redis 后置。
4. Home Assistant 不放在公网 VPS 上，放在家庭 LAN（见 `docs/architecture/NETWORK_ARCHITECTURE.md`）。
5. 镜像瘦身：Docker 镜像已占 13.68GB、可回收 9.073GB，Stage 1 前须由用户批准清理方案，本阶段不清理。
6. 备份先行：数据库卷与配置卷的备份策略须在部署前定稿（见 `docs/architecture/SECURITY_DESIGN.md`）。

## 3. 风险登记（本阶段只记录，不处置）

| # | 风险 | 证据 | 等级 |
|---|---|---|---|
| R-S1 | UFW inactive，INPUT ACCEPT，公网暴露面靠服务绑定控制 | 原始记录 §09 | 中 |
| R-S2 | 无 Swap，内存耗尽时无缓冲 | SwapTotal 0 kB | 低~中 |
| R-S3 | Docker 镜像 13.68GB 中 66% 可回收，磁盘会被构建缓存挤占 | `docker df` | 低 |
| R-S4 | 与 5 个现有业务共用一台服务器，相互影响面未隔离验证 | 10 个容器在跑 | 中 |
| R-S5 | 22/80/443/24443/24444 公网监听，其中 24443/24444 属 3x-ui，需确认是否为有意暴露 | `ss` 输出 | 待用户确认 |
| R-S6 | 任务书 4 GB 与实测 7.6 GiB 不符，目标服务器身份须最终确认 | 本报告第 0 节 | 待用户确认 |

## 4. 审计方法与限制声明

- 本审计为只读审计：仅执行系统信息读取命令，未修改配置、未安装软件、未重启/停止服务、未删除文件。
- 原始记录文件 `hidden_files/server_audit_raw_2026-11-19.txt` 为本次审计的唯一证据来源；本文件未引用该文件之外的任何服务器数据。
- 未检测的项目已在 1.3 节列出，不得理解为“已通过”或“不存在”。
- 下一步：待用户确认目标服务器身份与防火墙策略后，方可进入 Stage 1；Stage 1 的任何部署都须另行批准。
