import { useEffect, useState } from 'react'
import { listNetworkDevices, toDisplayText } from '../lib/api'
import type { NetworkDevice } from '../lib/api'
import {
  btnSecondary,
  EmptyState,
  ErrorBanner,
  Loading,
  PageHeader,
} from '../components/ui'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; devices: NetworkDevice[] }

export default function NetworkPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const load = () => {
    setState({ kind: 'loading' })
    listNetworkDevices()
      .then((devices) => setState({ kind: 'ok', devices }))
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [])

  return (
    <div>
      <PageHeader
        title="家庭网络管理中心"
        description="只读监控：在线设备列表来自 GET /api/v1/network/devices。本页不提供任何路由器配置、重启、限速等操作——高风险控制不在本阶段范围。"
        actions={
          <button type="button" className={btnSecondary} onClick={load}>
            刷新
          </button>
        }
      />

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && state.devices.length === 0 && (
        <EmptyState
          title="路由器集成未接入，只读监控待接入后可用"
          description="后端 GET /api/v1/network/devices 未返回任何在线设备。路由器集成接入后，这里才会出现只读的在线设备列表。"
        />
      )}

      {state.kind === 'ok' && state.devices.length > 0 && (
        <ul className="mt-6 space-y-3">
          {state.devices.map((d, i) => (
            <li
              key={d.mac ?? d.ip ?? d.id ?? `net-${i}`}
              className="lila-card px-5 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-white">
                  {d.name ?? d.hostname ?? '未命名设备'}
                </p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    d.online
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                      : 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
                  }`}
                >
                  {d.online === null || d.online === undefined
                    ? '状态未知'
                    : d.online
                      ? '在线'
                      : '离线'}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                IP：{toDisplayText(d.ip)} · MAC：{toDisplayText(d.mac)}
                {d.signal !== null && d.signal !== undefined
                  ? ` · 信号：${toDisplayText(d.signal)}`
                  : ''}
                {d.last_seen ? ` · 最后出现：${d.last_seen}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
