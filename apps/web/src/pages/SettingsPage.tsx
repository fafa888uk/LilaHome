import { useEffect, useState } from 'react'
import {
  changePassword,
  listAuditLogs,
  listIntegrations,
  listUsers,
  toDisplayText,
} from '../lib/api'
import type { AppUser, AuditLog, Integration } from '../lib/api'
import {
  btnPrimary,
  btnSecondary,
  EmptyState,
  ErrorBanner,
  inputClass,
  labelClass,
  Loading,
  PageHeader,
} from '../components/ui'

type UsersState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; users: AppUser[] }

type LogsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; logs: AuditLog[]; total: number | null; page: number }

type IntegrationsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; integrations: Integration[] }

const PAGE_SIZE = 20

export default function SettingsPage() {
  const [users, setUsers] = useState<UsersState>({ kind: 'loading' })
  const [logs, setLogs] = useState<LogsState>({ kind: 'loading' })
  const [integrations, setIntegrations] = useState<IntegrationsState>({ kind: 'loading' })
  const [page, setPage] = useState(1)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMessage, setPwMessage] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const loadUsers = () => {
    setUsers({ kind: 'loading' })
    listUsers()
      .then((items) => setUsers({ kind: 'ok', users: items }))
      .catch((err: unknown) => {
        setUsers({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  const loadLogs = (p: number) => {
    setLogs({ kind: 'loading' })
    listAuditLogs(p, PAGE_SIZE)
      .then((result) =>
        setLogs({
          kind: 'ok',
          logs: result.items,
          total: result.total ?? null,
          page: result.page ?? p,
        }),
      )
      .catch((err: unknown) => {
        setLogs({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  const loadIntegrations = () => {
    setIntegrations({ kind: 'loading' })
    listIntegrations()
      .then((items) => setIntegrations({ kind: 'ok', integrations: items }))
      .catch((err: unknown) => {
        setIntegrations({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })
  }

  useEffect(loadUsers, [])
  useEffect(loadIntegrations, [])
  useEffect(() => loadLogs(page), [page])

  return (
    <div>
      <PageHeader
        title="系统安全与设置中心"
        description="用户、审计日志与接入状态均来自后端。登录已启用：全部接口要求 JWT，管理员（owner）可管理设备、房间、场景与集成，成员（member）可控制设备与执行场景。"
      />

      <section className="mt-6">
        <h2 className="text-base font-semibold text-zinc-200">修改密码</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          修改当前登录账号的密码（新密码最短 8 位）。修改后之前签发的 Token 仍有效到过期。
        </p>
        <form
          className="mt-3 max-w-md space-y-3 lila-card px-5 py-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setPwMessage(null)
            setPwError(null)
            if (newPassword.length < 8) {
              setPwError('新密码最短 8 位。')
              return
            }
            if (newPassword !== confirmPassword) {
              setPwError('两次输入的新密码不一致。')
              return
            }
            setPwBusy(true)
            try {
              await changePassword({
                current_password: currentPassword,
                new_password: newPassword,
              })
              setCurrentPassword('')
              setNewPassword('')
              setConfirmPassword('')
              setPwMessage('密码已修改。')
            } catch (err: unknown) {
              setPwError(err instanceof Error ? err.message : String(err))
            } finally {
              setPwBusy(false)
            }
          }}
        >
          <div>
            <label className={labelClass} htmlFor="pw-current">
              当前密码
            </label>
            <input
              id="pw-current"
              type="password"
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={128}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pw-new">
              新密码（最短 8 位）
            </label>
            <input
              id="pw-new"
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="pw-confirm">
              再输一次新密码
            </label>
            <input
              id="pw-confirm"
              type="password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
            />
          </div>
          {pwError && (
            <p className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {pwError}
            </p>
          )}
          {pwMessage && (
            <p className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
              {pwMessage}
            </p>
          )}
          <button type="submit" className={btnPrimary} disabled={pwBusy}>
            {pwBusy ? '请稍候……' : '修改密码'}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-zinc-200">用户与角色</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          来自 GET /api/v1/users。第一个账号为管理员（owner），其余账号为成员（member）。
        </p>
        {users.kind === 'loading' && <Loading />}
        {users.kind === 'error' && <ErrorBanner message={users.message} onRetry={loadUsers} />}
        {users.kind === 'ok' && users.users.length === 0 && (
          <EmptyState
            title="暂无用户"
            description="后端 GET /api/v1/users 未返回任何用户。"
          />
        )}
        {users.kind === 'ok' && users.users.length > 0 && (
          <ul className="mt-3 space-y-3">
            {users.users.map((u) => (
              <li
                key={u.id}
                className="lila-card px-5 py-4"
              >
                <p className="font-semibold text-white">
                  {u.username ?? u.name ?? u.email ?? u.id}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  角色：
                  {u.role
                    ? u.role === 'owner'
                      ? '管理员'
                      : u.role
                    : u.roles && u.roles.length > 0
                      ? u.roles.join('、')
                      : '—'}
                  {u.email ? ` · 邮箱：${toDisplayText(u.email)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-zinc-200">审计日志</h2>
        <p className="mt-1 text-sm text-zinc-400">
          来自 GET /api/v1/audit-logs，每页 {PAGE_SIZE} 条。
        </p>
        {logs.kind === 'loading' && <Loading />}
        {logs.kind === 'error' && (
          <ErrorBanner message={logs.message} onRetry={() => loadLogs(page)} />
        )}
        {logs.kind === 'ok' && logs.logs.length === 0 && (
          <EmptyState title="暂无审计日志" description="后端未返回任何审计记录。" />
        )}
        {logs.kind === 'ok' && logs.logs.length > 0 && (
          <>
            <ul className="mt-3 space-y-3">
              {logs.logs.map((log, i) => (
                <li
                  key={log.id ?? `${log.created_at ?? log.timestamp ?? ''}-${i}`}
                  className="lila-card px-5 py-4"
                >
                  <p className="text-sm text-zinc-100">
                    <span className="font-semibold">{toDisplayText(log.action)}</span>
                    {log.target ? ` · ${log.target}` : ''}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    操作者：{toDisplayText(log.actor)} · 时间：
                    {toDisplayText(log.created_at ?? log.timestamp)}
                  </p>
                  {log.detail ? (
                    <p className="mt-1 break-words text-xs text-zinc-500">{log.detail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={btnSecondary}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <span className="text-sm text-zinc-400">
                第 {logs.page} 页
                {logs.total !== null ? ` · 共 ${logs.total} 条` : ''}
              </span>
              <button
                type="button"
                className={btnSecondary}
                disabled={logs.total !== null && page * PAGE_SIZE >= logs.total}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-zinc-200">接入状态总览</h2>
        <p className="mt-1 text-sm text-zinc-400">
          来自 GET /api/v1/integrations。HA、MQTT 等集成尚未接入前，全部标“未接入”。
        </p>
        {integrations.kind === 'loading' && <Loading />}
        {integrations.kind === 'error' && (
          <ErrorBanner message={integrations.message} onRetry={loadIntegrations} />
        )}
        {integrations.kind === 'ok' && integrations.integrations.length === 0 && (
          <EmptyState
            title="暂无集成"
            description="后端 GET /api/v1/integrations 未返回任何集成。集成接入后，这里才会出现启用状态。"
          />
        )}
        {integrations.kind === 'ok' && integrations.integrations.length > 0 && (
          <ul className="mt-3 space-y-3">
            {integrations.integrations.map((item, i) => {
              // 集成尚未接入：后端未返回已连接状态时一律标“未接入”；
              // 若后端将来明确返回已连接状态，则如实显示后端原文。
              const s = (item.status ?? '').toLowerCase()
              const connected =
                s === 'ok' || s === 'connected' || s === 'healthy' || s === 'up'
              const badgeText = connected ? (item.status ?? '已接入') : '未接入'
              return (
              <li
                key={item.id ?? item.name ?? `integration-${i}`}
                className="lila-card px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-white">{item.name}</p>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${
                      connected
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                        : 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
                    }`}
                  >
                    {badgeText}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  类型：{toDisplayText(item.type)} · 启用：
                  {item.enabled === null || item.enabled === undefined
                    ? '—'
                    : item.enabled
                      ? '是'
                      : '否'}
                </p>
                {item.detail ? (
                  <p className="mt-1 break-words text-xs text-zinc-500">{item.detail}</p>
                ) : null}
              </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
