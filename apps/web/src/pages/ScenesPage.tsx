import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createScene, deleteScene, listScenes, updateScene } from '../lib/api'
import type { JsonValue, Scene } from '../lib/api'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  EmptyState,
  ErrorBanner,
  inputClass,
  labelClass,
  Loading,
  PageHeader,
} from '../components/ui'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; scenes: Scene[] }

export default function ScenesPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rulesText, setRulesText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = () => {
    setState({ kind: 'loading' })
    listScenes()
      .then((scenes) => setState({ kind: 'ok', scenes }))
      .catch((err: unknown) => {
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(load, [])

  const parseRules = (text: string): Record<string, JsonValue> | null => {
    const trimmed = text.trim()
    if (trimmed.length === 0) return null
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('rules 必须是 JSON 对象')
    }
    return parsed as Record<string, JsonValue>
  }

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length === 0) {
      setFormError('请填写场景名称')
      return
    }
    let rules: Record<string, JsonValue> | null = null
    try {
      rules = parseRules(rulesText)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err))
      return
    }
    setFormError(null)
    setBusy(true)
    createScene({ name: name.trim(), description: description.trim() || undefined, rules })
      .then(() => {
        setName('')
        setDescription('')
        setRulesText('')
        load()
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setBusy(false))
  }

  const submitEdit = (e: React.FormEvent, scene: Scene) => {
    e.preventDefault()
    if (editName.trim().length === 0) {
      setFormError('请填写场景名称')
      return
    }
    setFormError(null)
    setBusy(true)
    updateScene(scene.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    })
      .then(() => {
        setEditingId(null)
        load()
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setBusy(false))
  }

  const confirmDelete = (scene: Scene) => {
    setFormError(null)
    setBusy(true)
    deleteScene(scene.id)
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
        title="自动化场景中心"
        description="场景只存储、不自动执行：规则以 JSON 存储在后端，执行器后续阶段接入。执行时逐设备留记录，单台失败不谎报整体成功。"
      />

      <form
        onSubmit={submitNew}
        className="mt-6 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-5"
      >
        <h2 className="text-base font-semibold text-white">新增场景</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="scene-name">名称 *</label>
            <input
              id="scene-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：回家模式"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="scene-desc">描述</label>
            <input
              id="scene-desc"
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="场景说明（可选）"
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="scene-rules">
            rules（JSON 对象，可留空；只存储不执行）
          </label>
          <textarea
            id="scene-rules"
            className={inputClass}
            rows={3}
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            placeholder='例如：{"trigger": "time", "at": "18:00"}'
          />
        </div>
        {formError ? (
          <p className="break-words rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {formError}
          </p>
        ) : null}
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? '正在提交……' : '创建场景'}
        </button>
      </form>

      {state.kind === 'loading' && <Loading />}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

      {state.kind === 'ok' && state.scenes.length === 0 && (
        <EmptyState
          title="暂无场景"
          description="还没有创建任何场景。先在上方新增一个场景，再到详情页添加动作。"
        />
      )}

      {state.kind === 'ok' && state.scenes.length > 0 && (
        <ul className="mt-6 space-y-3">
          {state.scenes.map((scene) => (
            <li
              key={scene.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4"
            >
              {editingId === scene.id ? (
                <form
                  onSubmit={(e) => submitEdit(e, scene)}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    className={inputClass}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="场景新名称"
                  />
                  <input
                    className={inputClass}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    aria-label="场景新描述"
                    placeholder="描述（可选）"
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
              ) : deletingId === scene.id ? (
                <div>
                  <p className="font-semibold text-white">确定删除场景「{scene.name}」吗？</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    删除后该场景的动作与执行记录随之失效（后端软删除）。
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className={btnDanger}
                      disabled={busy}
                      onClick={() => confirmDelete(scene)}
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
                    <Link
                      to={`/scenes/${encodeURIComponent(scene.id)}`}
                      className="font-semibold text-white hover:text-violet-300"
                    >
                      {scene.name}
                    </Link>
                    {scene.description ? (
                      <p className="mt-1 text-sm text-zinc-400">{scene.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => {
                        setEditingId(scene.id)
                        setEditName(scene.name)
                        setEditDescription(scene.description ?? '')
                        setDeletingId(null)
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => {
                        setDeletingId(scene.id)
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
