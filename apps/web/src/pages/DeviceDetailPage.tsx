import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  commandStatusText,
  getDevice,
  getDeviceState,
  listDeviceCommands,
  sendDeviceCommand,
  toDisplayText,
} from '../lib/api'
import type { CommandResult, Device, DeviceCommand, DeviceState, JsonValue } from '../lib/api'
import {
  btnPrimary,
  btnSecondary,
  Card,
  ErrorBanner,
  inputClass,
  labelClass,
  Loading,
  PageHeader,
  StatusBadge,
} from '../components/ui'
import { deviceTypeLabel } from '../lib/deviceTypes'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ok'
      device: Device
      state: DeviceState | null
      stateError: string | null
      commands: DeviceCommand[]
    }

function parseParams(text: string): Record<string, JsonValue> {
  const trimmed = text.trim()
  if (trimmed.length === 0) return {}
  const parsed: unknown = JSON.parse(trimmed)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('params 必须是 JSON 对象，例如 {"brightness": 80}')
  }
  return parsed as Record<string, JsonValue>
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [action, setAction] = useState('turn_on')
  const [paramsText, setParamsText] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<CommandResult | null>(null)
  const [sending, setSending] = useState(false)

  const load = () => {
    if (!id) return
    setState({ kind: 'loading' })
    Promise.allSettled([getDevice(id), getDeviceState(id), listDeviceCommands(id)]).then(
      ([deviceRes, stateRes, commandsRes]) => {
        if (deviceRes.status === 'rejected') {
          setState({
            kind: 'error',
            message:
              deviceRes.reason instanceof Error
                ? deviceRes.reason.message
                : String(deviceRes.reason),
          })
          return
        }
        setState({
          kind: 'ok',
          device: deviceRes.value,
          state: stateRes.status === 'fulfilled' ? stateRes.value : null,
          stateError:
            stateRes.status === 'rejected'
              ? stateRes.reason instanceof Error
                ? stateRes.reason.message
                : String(stateRes.reason)
              : null,
          commands: commandsRes.status === 'fulfilled' ? commandsRes.value : [],
        })
      },
    )
  }

  useEffect(load, [id])

  const submitCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    let params: Record<string, JsonValue>
    try {
      params = parseParams(paramsText)
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : String(err))
      setSendResult(null)
      return
    }
    setSendError(null)
    setSendResult(null)
    setSending(true)
    sendDeviceCommand(id, { action: action.trim(), params })
      .then((result) => {
        setSendResult(result)
        load()
      })
      .catch((err: unknown) => {
        setSendError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setSending(false))
  }

  return (
    <div>
      <Link to="/devices" className="text-sm text-violet-300 hover:text-violet-200">
        ← 返回设备列表
      </Link>
      <div className="mt-3">
        <PageHeader title="设备详情" description="基本信息、最后已知状态与指令历史均来自后端。" />
      </div>

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && (
        <div className="mt-6 space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">{state.device.name}</h2>
              <span className="rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2.5 py-0.5 text-xs text-zinc-400">
                未接入
              </span>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-zinc-500">品牌</dt>
                <dd className="text-zinc-200">{toDisplayText(state.device.brand)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-zinc-500">型号</dt>
                <dd className="text-zinc-200">{toDisplayText(state.device.model)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-zinc-500">类型</dt>
                <dd className="text-zinc-200">{deviceTypeLabel(state.device.type)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-zinc-500">集成</dt>
                <dd className="text-zinc-200">{toDisplayText(state.device.integration)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-zinc-500">兼容等级</dt>
                <dd className="text-zinc-200">
                  {toDisplayText(state.device.compatibility_level)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-zinc-500">设备 ID</dt>
                <dd className="break-all text-zinc-200">{state.device.id}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-white">最后已知状态</h2>
            {state.stateError ? (
              <p className="mt-2 break-words text-sm text-red-300">
                状态加载失败：{state.stateError}
              </p>
            ) : state.state ? (
              <div className="mt-2 space-y-1.5 text-sm">
                <p className="text-zinc-400">
                  来源：{toDisplayText(state.state.source)} · 更新时间：
                  {toDisplayText(state.state.updated_at)} · 实时：
                  {state.state.is_realtime === null || state.state.is_realtime === undefined
                    ? '—'
                    : state.state.is_realtime
                      ? '是'
                      : '否（最后已知状态，非实时）'}
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-zinc-300">
                  {JSON.stringify(state.state.state ?? state.state.raw ?? {}, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">后端未返回状态。</p>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-white">发送指令</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              发送成功只代表指令已接收，不代表设备已执行；结果以返回的状态与 detail
              原文为准，HA 未接入时为 UNKNOWN。
            </p>
            <form onSubmit={submitCommand} className="mt-3 space-y-3">
              <div>
                <label className={labelClass} htmlFor="cmd-action">action</label>
                <input
                  id="cmd-action"
                  className={inputClass}
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="例如：turn_on"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="cmd-params">
                  params（JSON 对象，可留空）
                </label>
                <textarea
                  id="cmd-params"
                  className={inputClass}
                  rows={3}
                  value={paramsText}
                  onChange={(e) => setParamsText(e.target.value)}
                  placeholder='例如：{"brightness": 80}'
                />
              </div>
              <button type="submit" className={btnPrimary} disabled={sending}>
                {sending ? '正在发送……' : '发送指令'}
              </button>
            </form>
            {sendError ? (
              <p className="mt-3 break-words rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                {sendError}
              </p>
            ) : null}
            {sendResult ? (
              <div className="mt-3 rounded-lg border border-zinc-700 bg-black/30 px-3 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-400">返回状态：</span>
                  <StatusBadge status={sendResult.status} />
                  <span className="text-zinc-300">{commandStatusText(sendResult.status)}</span>
                </p>
                {sendResult.command_id ? (
                  <p className="mt-1.5 break-all text-zinc-400">
                    command_id：{sendResult.command_id}
                  </p>
                ) : null}
                {sendResult.detail ? (
                  <p className="mt-1.5 break-words text-zinc-300">detail：{sendResult.detail}</p>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white">指令历史</h2>
              <button type="button" className={btnSecondary} onClick={load}>
                刷新
              </button>
            </div>
            {state.commands.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">暂无指令记录。</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.commands.map((c, i) => (
                  <li
                    key={c.command_id ?? c.id ?? `${c.action}-${i}`}
                    className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2.5 text-sm"
                  >
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-100">{c.action ?? '—'}</span>
                      {c.status ? <StatusBadge status={c.status} /> : null}
                      <span className="text-xs text-zinc-500">
                        {toDisplayText(c.created_at)}
                      </span>
                    </p>
                    {c.detail ? (
                      <p className="mt-1 break-words text-xs text-zinc-400">{c.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
