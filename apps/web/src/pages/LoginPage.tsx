import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAuthStatus, login, setToken, setupOwner } from '../lib/api'
import { btnPrimary, ErrorBanner, inputClass, labelClass, Loading } from '../components/ui'

type Mode =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'setup' }
  | { kind: 'login' }

/** 登录页 /login。
 *
 * 首次打开且后端无用户时显示首次设置表单（建 owner 账号）；
 * 已有用户时显示登录表单。成功后存 JWT 并进首页。
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>({ kind: 'loading' })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadStatus = () => {
    setMode({ kind: 'loading' })
    fetchAuthStatus()
      .then((s) => setMode(s.setup_required ? { kind: 'setup' } : { kind: 'login' }))
      .catch((err: unknown) =>
        setMode({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        }),
      )
  }

  useEffect(loadStatus, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode.kind === 'setup') {
      if (password.length < 8) {
        setError('密码最短 8 位。')
        return
      }
      if (password !== confirm) {
        setError('两次输入的密码不一致。')
        return
      }
    }
    setBusy(true)
    try {
      const result =
        mode.kind === 'setup'
          ? await setupOwner({ username: username.trim(), password })
          : await login({ username: username.trim(), password })
      setToken(result.token)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (mode.kind === 'loading') return <Loading text="正在检查登录状态……" />
  if (mode.kind === 'error') {
    return <ErrorBanner message={mode.message} onRetry={loadStatus} />
  }

  const isSetup = mode.kind === 'setup'

  return (
    <div className="mx-auto mt-10 max-w-md">
      <h1 className="text-2xl font-bold text-white">Lila Home</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {isSetup
          ? '首次使用：创建一个管理员账号（之后登录都用它）。用户名与密码只保存在你自己的服务器上。'
          : '请登录后使用。'}
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-6"
      >
        <div>
          <label className={labelClass} htmlFor="login-username">
            用户名
          </label>
          <input
            id="login-username"
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder={isSetup ? '例如 admin' : '用户名'}
            maxLength={64}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="login-password">
            密码{isSetup ? '（最短 8 位）' : ''}
          </label>
          <input
            id="login-password"
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSetup ? 'new-password' : 'current-password'}
            placeholder="密码"
            maxLength={128}
          />
        </div>
        {isSetup && (
          <div>
            <label className={labelClass} htmlFor="login-confirm">
              再输一次密码
            </label>
            <input
              id="login-confirm"
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="再输一次密码"
              maxLength={128}
            />
          </div>
        )}
        {error && (
          <p className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>
          {busy ? '请稍候……' : isSetup ? '创建管理员账号' : '登录'}
        </button>
      </form>
    </div>
  )
}
