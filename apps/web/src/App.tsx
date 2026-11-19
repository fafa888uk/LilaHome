import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import DevicesPage from './pages/DevicesPage'
import HomePage from './pages/HomePage'
import PlaceholderPage from './pages/PlaceholderPage'
import StatusPage from './pages/StatusPage'

const NAV = [
  { to: '/', label: '首页总览' },
  { to: '/devices', label: '设备' },
  { to: '/status', label: '系统状态' },
]

function navClass(active: boolean) {
  return active
    ? 'rounded-lg bg-violet-500/20 px-3 py-1.5 text-sm text-violet-200'
    : 'rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0b0a12] text-zinc-200">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0b0a12]/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link to="/" className="text-lg font-bold tracking-tight text-white">
              Lila Home
            </Link>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              紫序智能家居控制中心 · v0.1
            </span>
            <nav className="ml-auto flex items-center gap-1">
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
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/rooms" element={<PlaceholderPage name="房间管理中心" />} />
            <Route path="/lights" element={<PlaceholderPage name="灯光控制中心" />} />
            <Route
              path="/climate"
              element={<PlaceholderPage name="空调及热水器控制" />}
            />
            <Route path="/media" element={<PlaceholderPage name="音响影音中心" />} />
            <Route
              path="/network"
              element={<PlaceholderPage name="家庭网络管理中心" />}
            />
            <Route
              path="/scenes"
              element={<PlaceholderPage name="自动化场景中心" />}
            />
            <Route
              path="*"
              element={<PlaceholderPage name="页面不存在" />}
            />
          </Routes>
        </main>

        <footer className="mx-auto w-full max-w-5xl px-4 pb-8 pt-2">
          <p className="border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
            Lila Home v0.1 基础平台 · 访问控制：Tailscale（登录模块：PLANNED，v0.1
            不做应用内登录）· 设备尚未接入，所有状态以真实检查为准。
          </p>
        </footer>
      </div>
    </BrowserRouter>
  )
}
