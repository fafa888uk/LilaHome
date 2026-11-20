import { useEffect, useState } from 'react'
import { createDevice, listDevices, listRooms } from '../lib/api'
import type { Device, Room } from '../lib/api'
import { DEVICE_TYPES, deviceTypeLabel } from '../lib/deviceTypes'
import {
  ComputerCard,
  DeviceTile,
  EmptyState,
  ErrorBanner,
  btnPrimary,
  inputClass,
  isComputer,
  labelClass,
  Loading,
  PageHeader,
} from '../components/ui'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; devices: Device[]; rooms: Room[] }

/** 把后端返回的错误转成可读文案：FastAPI 校验错误会把 detail 数组拼进
 *  message 里（如 "参数校验失败 [{...}]（validation_error）"），直接贴出来
 *  用户看不懂；这里只保留前缀与每项的字段名 + 原因，不贴原始 JSON。 */
function readableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start >= 0 && end > start) {
    const prefix = raw.slice(0, start).trim()
    try {
      const items = JSON.parse(raw.slice(start, end + 1)) as Array<{
        loc?: unknown
        msg?: string
      }>
      if (Array.isArray(items) && items.length > 0) {
        const parts = items.map((it) => {
          const loc = Array.isArray(it.loc)
            ? it.loc.filter((x) => x !== 'body').join('.')
            : ''
          const msg = typeof it.msg === 'string' && it.msg.length > 0 ? it.msg : '参数错误'
          return loc ? `${loc}：${msg}` : msg
        })
        return [prefix, parts.join('；')].filter(Boolean).join(' ')
      }
    } catch {
      // 解析失败则去掉 JSON 部分，只留前缀。
    }
    return prefix || '提交失败，请检查输入'
  }
  return raw
}

export default function DevicesPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [type, setType] = useState<string>(DEVICE_TYPES[0])
  const [roomId, setRoomId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setState({ kind: 'loading' })
    Promise.all([listDevices(), listRooms()])
      .then(([devices, rooms]) => setState({ kind: 'ok', devices, rooms }))
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length === 0) {
      setFormError('请填写设备名称')
      return
    }
    setFormError(null)
    setSubmitting(true)
    createDevice({
      name: name.trim(),
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      type,
      room_id: roomId || null,
    })
      .then(() => {
        setName('')
        setBrand('')
        setModel('')
        setType(DEVICE_TYPES[0])
        setRoomId('')
        setShowForm(false)
        load()
      })
      .catch((err: unknown) => {
        setFormError(readableError(err))
      })
      .finally(() => setSubmitting(false))
  }

  const roomName = (d: Device): string => {
    if (d.room_name) return d.room_name
    if (state.kind === 'ok' && d.room_id) {
      return state.rooms.find((r) => r.id === d.room_id)?.name ?? '未分组'
    }
    return '未分组'
  }

  return (
    <div>
      <PageHeader
        title="设备管理中心"
        description="设备登记只记录元数据，不直连设备。接入状态来自后端；HA 未接入前全部设备显示“未接入”。"
        actions={
          <button type="button" className={btnPrimary} onClick={() => setShowForm((v) => !v)}>
            {showForm ? '收起表单' : '新增设备'}
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={submit}
          className="lila-card mt-6 space-y-4 px-5 py-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="dev-name">名称 *</label>
              <input
                id="dev-name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：客厅主灯"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="dev-brand">品牌</label>
              <input
                id="dev-brand"
                className={inputClass}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="例如：小米"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="dev-model">型号</label>
              <input
                id="dev-model"
                className={inputClass}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如：米家吸顶灯"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="dev-type">类型</label>
              <select
                id="dev-type"
                className={inputClass}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {DEVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {deviceTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="dev-room">房间</label>
              <select
                id="dev-room"
                className={inputClass}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="">未分组</option>
                {state.kind === 'ok'
                  ? state.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))
                  : null}
              </select>
            </div>
          </div>
          {formError ? (
            <p className="break-words rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {formError}
            </p>
          ) : null}
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? '正在提交……' : '登记设备'}
          </button>
        </form>
      )}

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && state.devices.length === 0 && (
        <EmptyState
          title="暂无设备，请先完成设备清点"
          description="设备清点完成后才会在这里出现设备。在此之前，本页不展示任何设备、状态或数值。"
        />
      )}

      {state.kind === 'ok' && state.devices.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {state.devices.map((d) =>
            isComputer(d) ? (
              <ComputerCard key={d.id} device={d} />
            ) : (
              <DeviceTile
                key={d.id}
                device={d}
                roomName={roomName(d)}
                to={`/devices/${encodeURIComponent(d.id)}`}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
