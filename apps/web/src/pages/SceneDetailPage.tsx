import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addSceneAction,
  getSceneRun,
  listDevices,
  listSceneActions,
  listScenes,
  runScene,
} from '../lib/api'
import type { Device, JsonValue, Scene, SceneAction, SceneRun } from '../lib/api'
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

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; scene: Scene; actions: SceneAction[]; devices: Device[] }

export default function SceneDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [deviceId, setDeviceId] = useState('')
  const [actionName, setActionName] = useState('turn_on')
  const [paramsText, setParamsText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [run, setRun] = useState<SceneRun | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [lastRunId, setLastRunId] = useState<string | null>(null)

  const load = () => {
    if (!id) return
    setState({ kind: 'loading' })
    Promise.all([listScenes(), listSceneActions(id), listDevices()])
      .then(([scenes, actions, devices]) => {
        const scene = scenes.find((s) => s.id === id)
        if (!scene) {
          setState({ kind: 'error', message: '场景不存在或已被删除' })
          return
        }
        setState({ kind: 'ok', scene, actions, devices })
        if (devices.length > 0 && !deviceId) setDeviceId(devices[0].id)
      })
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [id])

  const submitAction = (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    if (!deviceId) {
      setFormError('请先选择设备（当前没有可用设备）')
      return
    }
    if (actionName.trim().length === 0) {
      setFormError('请填写 action')
      return
    }
    let params: Record<string, JsonValue> = {}
    try {
      const trimmed = paramsText.trim()
      if (trimmed.length > 0) {
        const parsed: unknown = JSON.parse(trimmed)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('params 必须是 JSON 对象')
        }
        params = parsed as Record<string, JsonValue>
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err))
      return
    }
    setFormError(null)
    setAdding(true)
    addSceneAction(id, { device_id: deviceId, action: actionName.trim(), params })
      .then(() => {
        setActionName('turn_on')
        setParamsText('')
        load()
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setAdding(false))
  }

  const execute = () => {
    if (!id) return
    setRunError(null)
    setRun(null)
    setRunning(true)
    runScene(id)
      .then(({ run_id }) => {
        setLastRunId(run_id)
        return getSceneRun(id, run_id)
      })
      .then((result) => setRun(result))
      .catch((err: unknown) => {
        setRunError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setRunning(false))
  }

  const refreshRun = () => {
    if (!id || !lastRunId) return
    getSceneRun(id, lastRunId)
      .then((result) => setRun(result))
      .catch((err: unknown) => {
        setRunError(err instanceof Error ? err.message : String(err))
      })
  }

  return (
    <div>
      <Link to="/scenes" className="text-sm text-violet-300 hover:text-violet-200">
        ← 返回场景列表
      </Link>
      <div className="mt-3">
        <PageHeader
          title="场景详情"
          description="动作与执行结果均来自后端。规则只存储不执行，执行器后续阶段接入。"
          actions={
            <button type="button" className={btnPrimary} onClick={execute} disabled={running}>
              {running ? '正在执行……' : '执行场景'}
            </button>
          }
        />
      </div>

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && (
        <div className="mt-6 space-y-4">
          <Card>
            <h2 className="text-lg font-semibold text-white">{state.scene.name}</h2>
            {state.scene.description ? (
              <p className="mt-1 text-sm text-zinc-400">{state.scene.description}</p>
            ) : null}
            <h3 className="mt-4 text-sm font-semibold text-zinc-200">规则（只读）</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              规则只存储不执行，执行器后续阶段接入。
            </p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-zinc-300">
              {JSON.stringify(state.scene.rules ?? {}, null, 2)}
            </pre>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-white">动作列表</h2>
            {state.actions.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">该场景还没有动作。</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.actions.map((a, i) => (
                  <li
                    key={a.id ?? `${a.device_id}-${a.action}-${i}`}
                    className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2.5 text-sm"
                  >
                    <p className="text-zinc-100">
                      <span className="font-semibold">{a.device_name ?? a.device_id}</span>
                      {' → '}
                      {a.action}
                    </p>
                    {a.params ? (
                      <p className="mt-1 break-words text-xs text-zinc-400">
                        {JSON.stringify(a.params)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={submitAction} className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-semibold text-zinc-200">添加动作</h3>
              <div>
                <label className={labelClass} htmlFor="act-device">设备</label>
                <select
                  id="act-device"
                  className={inputClass}
                  value={deviceId}
                  disabled={state.devices.length === 0}
                  onChange={(e) => setDeviceId(e.target.value)}
                >
                  {state.devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {state.devices.length === 0 ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    当前没有可用设备，请先到设备管理中心登记设备。
                  </p>
                ) : null}
              </div>
              <div>
                <label className={labelClass} htmlFor="act-action">action</label>
                <input
                  id="act-action"
                  className={inputClass}
                  value={actionName}
                  onChange={(e) => setActionName(e.target.value)}
                  placeholder="例如：turn_on"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="act-params">
                  params（JSON 对象，可留空）
                </label>
                <textarea
                  id="act-params"
                  className={inputClass}
                  rows={2}
                  value={paramsText}
                  onChange={(e) => setParamsText(e.target.value)}
                  placeholder='例如：{"brightness": 80}'
                />
              </div>
              {formError ? (
                <p className="break-words rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                  {formError}
                </p>
              ) : null}
              <button
                type="submit"
                className={btnPrimary}
                disabled={adding || state.devices.length === 0}
              >
                {adding ? '正在添加……' : '添加动作'}
              </button>
            </form>
          </Card>

          {runError ? (
            <ErrorBanner message={runError} />
          ) : null}

          {run ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">
                  执行结果{run.status ? `（${run.status}）` : ''}
                </h2>
                <button type="button" className={btnSecondary} onClick={refreshRun}>
                  刷新执行结果
                </button>
              </div>
              <p className="mt-1 break-all text-xs text-zinc-500">run_id：{run.run_id}</p>
              {run.results.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-400">
                  后端未返回逐设备执行结果，原始返回见下方。
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {run.results.map((r, i) => (
                    <li
                      key={`${r.device_id ?? 'unknown'}-${i}`}
                      className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2.5 text-sm"
                    >
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-100">
                          {r.device_name ?? r.device_id ?? '未知设备'}
                        </span>
                        {r.action ? (
                          <span className="text-zinc-400">{r.action}</span>
                        ) : null}
                        {r.status ? <StatusBadge status={r.status} /> : null}
                      </p>
                      {r.detail ? (
                        <p className="mt-1 break-words text-xs text-zinc-400">{r.detail}</p>
                      ) : null}
                      {r.status && r.status.toUpperCase() === 'UNKNOWN' ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          已发送，未确认（HA 未接入）——不代表已执行。
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
                <summary className="cursor-pointer text-sm text-zinc-300">原始返回 JSON</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-400">
                  {JSON.stringify(run.raw ?? {}, null, 2)}
                </pre>
              </details>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}
