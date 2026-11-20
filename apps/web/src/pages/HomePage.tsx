import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Database,
  DoorOpen,
  House,
  LayoutGrid,
  Lightbulb,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Speaker,
  Thermometer,
  Wifi,
} from 'lucide-react'
import { fetchStatus, listDevices, listRooms } from '../lib/api'
import type { Device, HealthCheckItem, Room, StatusResponse } from '../lib/api'
import {
  ComputerCard,
  DeviceTile,
  EmptyState,
  ErrorBanner,
  Loading,
  SectionHeader,
  isComputer,
} from '../components/ui'

interface ModuleCard {
  name: string
  path: string
  description: string
  icon: typeof LayoutGrid
}

const MODULES: ModuleCard[] = [
  { name: '设备管理中心', path: '/devices', description: '设备登记、改名、换房间、指令历史。', icon: LayoutGrid },
  { name: '房间管理中心', path: '/rooms', description: '房间创建、改名、删除与设备分组。', icon: DoorOpen },
  { name: '灯光控制中心', path: '/lights', description: '灯光开关、亮度与色温控制。', icon: Lightbulb },
  {
    name: '空调及热水器控制',
    path: '/climate',
    description: '空调模式与目标温度、热水器控制。',
    icon: Thermometer,
  },
  { name: '音响影音中心', path: '/speakers', description: '音箱播放状态与 TTS 播报。', icon: Speaker },
  { name: '家庭网络管理中心', path: '/network', description: '路由器只读监控，在线设备列表。', icon: Wifi },
  { name: '自动化场景中心', path: '/scenes', description: '场景创建、编辑与执行。', icon: Sparkles },
  { name: '系统安全与设置中心', path: '/settings', description: '用户、审计日志与接入状态。', icon: ShieldCheck },
  { name: '系统状态', path: '/status', description: '后端健康检查原始返回。', icon: Activity },
]

/** 在 checks 里按关键字找一项；找不到返回 null，不编造。 */
function findCheck(checks: HealthCheckItem[], keywords: string[]): HealthCheckItem | null {
  const lower = (s: string) => s.toLowerCase()
  for (const kw of keywords) {
    const hit = checks.find((c) => lower(c.name).includes(lower(kw)))
    if (hit) return hit
  }
  return null
}

function checkState(status: string): 'ok' | 'error' | 'unknown' {
  const s = status.toLowerCase()
  if (s === 'ok' || s === 'healthy' || s === 'up' || s === 'pass') return 'ok'
  if (s === 'unknown') return 'unknown'
  return 'error'
}

function checkBadge(status: string) {
  const state = checkState(status)
  if (state === 'ok') return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
  if (state === 'unknown') return 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
  return 'border-red-400/40 bg-red-400/10 text-red-300'
}

function checkDot(status: string) {
  const state = checkState(status)
  if (state === 'ok') return 'bg-emerald-400'
  if (state === 'unknown') return 'bg-zinc-500'
  return 'bg-red-400'
}

interface RoomGroup {
  key: string
  name: string
  devices: Device[]
}

/** 按真实房间分组；没有房间的设备进“未分组”。不凭空建房间。 */
function groupDevices(devices: Device[], rooms: Room[]): RoomGroup[] {
  const sortedRooms = [...rooms].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'zh-CN'),
  )
  const byId = new Map<string, Device[]>()
  const ungrouped: Device[] = []
  for (const d of devices) {
    if (d.room_id && sortedRooms.some((r) => r.id === d.room_id)) {
      const list = byId.get(d.room_id) ?? []
      list.push(d)
      byId.set(d.room_id, list)
    } else {
      ungrouped.push(d)
    }
  }
  const groups: RoomGroup[] = sortedRooms.map((r) => ({
    key: r.id,
    name: r.name,
    devices: byId.get(r.id) ?? [],
  }))
  groups.push({ key: '__ungrouped', name: '未分组', devices: ungrouped })
  return groups
}

type HomeState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ok'
      status: StatusResponse
      devices: Device[]
      rooms: Room[]
      devicesError: string | null
    }

export default function HomePage() {
  const [state, setState] = useState<HomeState>({ kind: 'loading' })

  const load = () => {
    setState({ kind: 'loading' })
    Promise.allSettled([fetchStatus(), listDevices(), listRooms()])
      .then(([statusRes, devicesRes, roomsRes]) => {
        if (statusRes.status === 'rejected') {
          setState({
            kind: 'error',
            message:
              statusRes.reason instanceof Error
                ? statusRes.reason.message
                : String(statusRes.reason),
          })
          return
        }
        setState({
          kind: 'ok',
          status: statusRes.value,
          devices: devicesRes.status === 'fulfilled' ? devicesRes.value : [],
          rooms: roomsRes.status === 'fulfilled' ? roomsRes.value : [],
          devicesError:
            devicesRes.status === 'rejected'
              ? devicesRes.reason instanceof Error
                ? devicesRes.reason.message
                : String(devicesRes.reason)
              : null,
        })
      })
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [])

  const wanted: Array<{ label: string; keywords: string[]; icon: typeof Database }> = [
    { label: '数据库', keywords: ['database', 'db', 'postgres', 'sqlite'], icon: Database },
    { label: 'MQTT', keywords: ['mqtt', 'mosquitto'], icon: RadioTower },
    { label: 'Home Assistant', keywords: ['home assistant', 'ha', 'hass'], icon: House },
  ]

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="animate-fade-up">
      <section className="lila-card relative overflow-hidden px-5 py-6 sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl"
        />
        <p className="relative text-sm text-violet-300">{today}</p>
        <h1 className="relative mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Lila Home
        </h1>
        <p className="relative mt-2 text-lg text-violet-200">紫序智能家居控制中心</p>
        <p className="relative mt-4 text-sm leading-relaxed text-zinc-300">
          以下状态全部来自后端实时返回；后端不可达时不展示任何假数据。
        </p>
      </section>

      {state.kind === 'loading' && <Loading text="正在请求后端状态……" />}

      {state.kind === 'error' && (
        <ErrorBanner message={state.message} onRetry={load} />
      )}

      {state.kind === 'ok' && (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="lila-card px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm text-zinc-400">
                <Activity className="h-4 w-4 text-violet-300" />
                后端总体状态
              </p>
              <p className="mt-2 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${checkDot(state.status.status)}`} />
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-sm ${checkBadge(state.status.status)}`}
                >
                  {state.status.status}
                </span>
              </p>
            </div>
            {wanted.map((w) => {
              const check = findCheck(state.status.checks, w.keywords)
              const Icon = w.icon
              return (
                <div key={w.label} className="lila-card px-5 py-4">
                  <p className="flex items-center gap-1.5 text-sm text-zinc-400">
                    <Icon className="h-4 w-4 text-violet-300" />
                    {w.label}
                  </p>
                  {check ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${checkDot(check.status)}`} />
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-sm ${checkBadge(check.status)}`}
                      >
                        {check.status}
                      </span>
                      <span className="break-words text-xs text-zinc-500">{check.detail}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">后端未返回该项</p>
                  )}
                </div>
              )
            })}
            <div className="lila-card px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm text-zinc-400">
                <LayoutGrid className="h-4 w-4 text-violet-300" />
                设备总数
              </p>
              {state.devicesError ? (
                <p className="mt-2 break-words text-sm text-red-300">
                  设备列表加载失败：{state.devicesError}
                </p>
              ) : (
                <p className="mt-2 text-2xl font-bold text-white">{state.devices.length}</p>
              )}
              <p className="mt-1 text-xs text-zinc-500">
                {state.devices.length === 0 && !state.devicesError
                  ? '暂无设备，请先完成设备清点'
                  : '来自 GET /api/v1/devices'}
              </p>
            </div>
          </section>

          <section className="mt-8">
            <SectionHeader
              icon={<House className="h-5 w-5" />}
              title="我的家"
              count={state.devices.length}
            />
            {state.devicesError ? (
              <ErrorBanner message={state.devicesError} onRetry={load} />
            ) : state.devices.length === 0 ? (
              <EmptyState
                title="暂无设备，请先完成设备清点"
                description="设备清点完成后才会按房间出现在这里。在此之前，本页不展示任何设备、状态或数值。"
              />
            ) : (
              groupDevices(state.devices, state.rooms).map((group) => (
                <div key={group.key} className="mt-5">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 text-violet-300" />
                    <h3 className="text-sm font-semibold text-zinc-200">{group.name}</h3>
                    <span className="text-xs text-zinc-500">{group.devices.length} 台</span>
                  </div>
                  {group.devices.length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-500">这个房间还没有设备。</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {group.devices.map((d) =>
                        isComputer(d) ? (
                          <ComputerCard key={d.id} device={d} />
                        ) : (
                          <DeviceTile
                            key={d.id}
                            device={d}
                            roomName={group.name}
                            to={`/devices/${encodeURIComponent(d.id)}`}
                          />
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        </>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold text-zinc-200">九大模块</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <Link
              key={m.path}
              to={m.path}
              className="lila-card lila-card-interactive animate-fade-up block p-5"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="lila-icon-tile h-11 w-11 bg-violet-500/15 p-2.5 text-violet-300">
                  <m.icon className="h-5 w-5" />
                </span>
                <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                  可用
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-white">{m.name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{m.description}</p>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          各模块页面均直接请求后端接口；设备、集成尚未接入时，页面如实显示“未接入”或空状态，不展示假设备与假数值。
        </p>
      </section>
    </div>
  )
}
