import { useEffect, useState } from 'react'
import { createRoom, deleteRoom, listRooms, updateRoom } from '../lib/api'
import type { Room } from '../lib/api'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  EmptyState,
  ErrorBanner,
  inputClass,
  Loading,
  PageHeader,
} from '../components/ui'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; rooms: Room[] }

export default function RoomsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [newName, setNewName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setState({ kind: 'loading' })
    listRooms()
      .then((rooms) => setState({ kind: 'ok', rooms }))
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [])

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim().length === 0) {
      setFormError('请填写房间名称')
      return
    }
    setFormError(null)
    setBusy(true)
    createRoom({ name: newName.trim() })
      .then(() => {
        setNewName('')
        load()
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setBusy(false))
  }

  const submitRename = (e: React.FormEvent, room: Room) => {
    e.preventDefault()
    if (editName.trim().length === 0) {
      setFormError('请填写房间名称')
      return
    }
    setFormError(null)
    setBusy(true)
    updateRoom(room.id, { name: editName.trim() })
      .then(() => {
        setEditingId(null)
        load()
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setBusy(false))
  }

  const confirmDelete = (room: Room) => {
    setFormError(null)
    setBusy(true)
    deleteRoom(room.id)
      .then(() => {
        setDeletingId(null)
        load()
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setBusy(false))
  }

  return (
    <div>
      <PageHeader
        title="房间管理中心"
        description="房间只做分组，不存放设备本体。删除房间时，房间内的设备只移出分组，不会被删除。"
      />

      <form
        onSubmit={submitNew}
        className="mt-6 flex flex-col gap-2 lila-card px-5 py-4 sm:flex-row sm:items-center"
      >
        <input
          className={inputClass}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新房间名称，例如：客厅"
          aria-label="新房间名称"
        />
        <button type="submit" className={`${btnPrimary} shrink-0`} disabled={busy}>
          新增房间
        </button>
      </form>

      {formError ? (
        <p className="mt-4 break-words rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {formError}
        </p>
      ) : null}

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && state.rooms.length === 0 && (
        <EmptyState
          title="暂无房间"
          description="还没有创建任何房间。先在上方新增一个房间，再把设备分进去。"
        />
      )}

      {state.kind === 'ok' && state.rooms.length > 0 && (
        <ul className="mt-6 space-y-3">
          {state.rooms.map((room) => (
            <li
              key={room.id}
              className="lila-card px-5 py-4"
            >
              {editingId === room.id ? (
                <form
                  onSubmit={(e) => submitRename(e, room)}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    className={inputClass}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="房间新名称"
                  />
                  <div className="flex shrink-0 gap-2">
                    <button type="submit" className={btnPrimary} disabled={busy}>
                      保存
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </button>
                  </div>
                </form>
              ) : deletingId === room.id ? (
                <div>
                  <p className="font-semibold text-white">确定删除「{room.name}」吗？</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    该房间内的设备只会移出分组，不会被删除。此操作会调用 DELETE
                    /api/v1/rooms/{'{id}'}。
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className={btnDanger}
                      disabled={busy}
                      onClick={() => confirmDelete(room)}
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => setDeletingId(null)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{room.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {room.device_count !== null && room.device_count !== undefined
                        ? `设备 ${room.device_count} 台`
                        : '设备数量后端未返回'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => {
                        setEditingId(room.id)
                        setEditName(room.name)
                        setDeletingId(null)
                      }}
                    >
                      改名
                    </button>
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => {
                        setDeletingId(room.id)
                        setEditingId(null)
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
