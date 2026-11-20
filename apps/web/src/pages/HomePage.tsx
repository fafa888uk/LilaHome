import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchStatus, listDevices } from '../lib/api'
import type { HealthCheckItem, StatusResponse } from '../lib/api'
import { ErrorBanner, Loading } from '../components/ui'

interface ModuleCard {
  name: string
  path: string
  description: string
}

const MODULES: ModuleCard[] = [
  { name: '设备管理中心', path: '/devices', description: '设备登记、改名、换房间、指令历史。' },
  { name: '房间管理中心', path: '/rooms', description: '房间创建、改名、删除与设备分组。' },
  { name: '灯光控制中心', path: '/lights', description: '灯光开关、亮度与色温控制。' },
  {
    name: '空调及热水器控制',
    path: '/climate',
    description: '空调模式与目标温度、热水器控制。',
  },
  { name: '音响影音中心', path: '/speakers', description: '音箱播放状态与 TTS 播报。' },
  { name: '家庭网络管理中心', path: '/network', description: '路由器只读监控，在线设备列表。' },
  { name: '自动化场景中心', path: '/scenes', description: '场景创建、编辑与执行。' },
  { name: '系统安全与设置中心', path: '/settings', description: '用户、审计日志与接入状态。' },
  { name: '系统状态', path: '/status', description: '后端健康检查原始返回。' },
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

type HomeState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ok'
      status: StatusResponse
      deviceCount: number
      devicesError: string | null
    }

export default function HomePage() {
  const [state, setState] = useState<HomeState>({ kind: 'loading' })

  const load = () => {
    setState({ kind: 'loading' })
    Promise.allSettled([fetchStatus(), listDevices()])
      .then(([statusRes, devicesRes]) => {
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
          deviceCount:
            devicesRes.status === 'fulfilled' ? devicesRes.value.length : 0,
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

  const wanted: Array<{ label: string; keywords: string[] }> = [
    { label: '数据库', keywords: ['database', 'db', 'postgres', 'sqlite'] },
    { label: 'MQTT', keywords: ['mqtt', 'mosquitto'] },
    { label: 'Home Assistant', keywords: ['home assistant', 'ha', 'hass'] },
  ]

  return (
    <div>
      <section className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-5 py-6 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Lila Home</h1>
        <p className="mt-2 text-lg text-violet-200">紫序智能家居控制中心</p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          以下状态全部来自后端实时返回；后端不可达时不展示任何假数据。
        </p>
      </section>

      {state.kind === 'loading' && <Loading text="正在请求后端状态……" />}

      {state.kind === 'error' && (
        <ErrorBanner message={state.message} onRetry={load} />
      )}

      {state.kind === 'ok' && (
        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4">
            <p className="text-sm text-zinc-400">后端总体状态</p>
            <p className="mt-2 flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-sm ${checkBadge(state.status.status)}`}
              >
                {state.status.status}
              </span>
            </p>
          </div>
          {wanted.map((w) => {
            const check = findCheck(state.status.checks, w.keywords)
            return (
              <div
                key={w.label}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4"
              >
                <p className="text-sm text-zinc-400">{w.label}</p>
                {check ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2">
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
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4">
            <p className="text-sm text-zinc-400">设备总数</p>
            {state.devicesError ? (
              <p className="mt-2 break-words text-sm text-red-300">
                设备列表加载失败：{state.devicesError}
              </p>
            ) : (
              <p className="mt-2 text-2xl font-bold text-white">{state.deviceCount}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              {state.deviceCount === 0 && !state.devicesError
                ? '暂无设备，请先完成设备清点'
                : '来自 GET /api/v1/devices'}
            </p>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-base font-semibold text-zinc-200">九大模块</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.path}
              to={m.path}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-violet-400/50 hover:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-white">{m.name}</h3>
                <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                  可用
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{m.description}</p>
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
