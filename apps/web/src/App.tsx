import { useEffect, useState, type ReactNode } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import ClimatePage from './pages/ClimatePage'
import DeviceDetailPage from './pages/DeviceDetailPage'
import DevicesPage from './pages/DevicesPage'
import HomePage from './pages/HomePage'
import LightsPage from './pages/LightsPage'
import LoginPage from './pages/LoginPage'
import NetworkPage from './pages/NetworkPage'
import RoomsPage from './pages/RoomsPage'
import SceneDetailPage from './pages/SceneDetailPage'
import ScenesPage from './pages/ScenesPage'
import SettingsPage from './pages/SettingsPage'
import SpeakersPage from './pages/SpeakersPage'
import StatusPage from './pages/StatusPage'
import { clearToken, fetchMe, getToken, type AuthUser } from './lib/api'

const NAV = [
  { to: '/', label: '首页总览' },
  { to: '/devices', label: '设备' },
  { to: '/rooms', label: '房间' },
  { to: '/lights', label: '灯光' },
  { to: '/climate', label: '空调' },
  { to: '/speakers', label: '音响' },
  { to: '/network', label: '网络' },
  { to: '/scenes', label: '场景' },
  { to: '/settings', label: '设置' },
  { to: '/status', label: '系统状态' },
]

function navClass(active: boolean) {
  return active
    ? 'rounded-lg bg-violet-500/20 px-3 py-1.5 text-sm text-violet-200'
    : 'rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
}

/** 未登录时跳回 /login；有 Token 但已过期时，后端 401 会由 api.ts 跳转。 */
function RequireAuth({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return <>{children}</>
}

function guarded(element: ReactNode) {
  return <RequireAuth>{element}</RequireAuth>
}

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [me, setMe] = useState<AuthUser | null>(null)

  // 路由变化时按 Token 刷新当前用户；无 Token 则清空。
  useEffect(() => {
    if (!getToken()) {
      setMe(null)
      return
    }
    let cancelled = false
    fetchMe()
      .then((u) => {
        if (!cancelled) setMe(u)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  const logout = () => {
    clearToken()
    setMe(null)
    navigate('/login', { replace: true })
  }

  const onLoginPage = location.pathname === '/login'

  return (
    <div className="min-h-screen bg-[#0b0a12] text-zinc-200">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0b0a12]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight text-white">
            Lila Home
          </Link>
          <span className="hidden text-xs text-zinc-500 sm:inline">
            紫序智能家居控制中心
          </span>
          {me && !onLoginPage && (
            <nav className="ml-auto flex flex-wrap items-center gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => navClass(isActive)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          {me && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-zinc-400">
                {me.username}
                <span className="ml-1 text-xs text-zinc-500">
                  ({me.role === 'owner' ? '管理员' : me.role})
                </span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700"
              >
                退出登录
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={guarded(<HomePage />)} />
          <Route path="/devices" element={guarded(<DevicesPage />)} />
          <Route path="/devices/:id" element={guarded(<DeviceDetailPage />)} />
          <Route path="/rooms" element={guarded(<RoomsPage />)} />
          <Route path="/lights" element={guarded(<LightsPage />)} />
          <Route path="/climate" element={guarded(<ClimatePage />)} />
          <Route path="/speakers" element={guarded(<SpeakersPage />)} />
          {/* 旧路径 /media 保留重定向到 /speakers */}
          <Route path="/media" element={<Navigate to="/speakers" replace />} />
          <Route path="/network" element={guarded(<NetworkPage />)} />
          <Route path="/scenes" element={guarded(<ScenesPage />)} />
          <Route path="/scenes/:id" element={guarded(<SceneDetailPage />)} />
          <Route path="/settings" element={guarded(<SettingsPage />)} />
          <Route path="/status" element={guarded(<StatusPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 pt-2">
        <p className="border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
          Lila Home · 访问控制：应用内登录（JWT，7 天有效期）+ Tailscale ·
          所有状态来自后端实时返回；HA / 集成未接入时如实显示“未接入”，不展示假数据。
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
