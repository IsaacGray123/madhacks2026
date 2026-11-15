import { useEffect, useState } from 'react'
import { useStatus } from './lib/hooks'
import CompanionPage from './pages/Companion'
import Home from './pages/Home'
import History from './pages/History'
import Report from './pages/Report'
import SettingsPage from './pages/Settings'

export type Route = { page: 'home' } | { page: 'history' } | { page: 'settings' } | { page: 'companion' } | { page: 'report'; id: number }

export default function App(): JSX.Element {
  const [route, setRoute] = useState<Route>({ page: 'home' })
  // Set when Start was tapped on the UNO Q touchscreen: Home runs the 5-second countdown.
  const [touchStart, setTouchStart] = useState(false)
  const status = useStatus()

  useEffect(
    () =>
      window.api.onNavigate((r) => {
        if (r.page === 'home' && r.countdown) setTouchStart(true)
        if (r.page === 'report' && r.id) setRoute({ page: 'report', id: r.id })
        else if (r.page === 'home' || r.page === 'history' || r.page === 'settings') setRoute({ page: r.page })
      }),
    []
  )

  const tab = route.page === 'report' ? 'history' : route.page
  const connected = status?.device.connected ?? false
  const live = status && status.status !== 'idle'

  const tabs: { key: 'home' | 'history' | 'companion' | 'settings'; label: string }[] = [
    { key: 'home', label: live ? 'Session' : 'Home' },
    { key: 'history', label: 'History' },
    { key: 'companion', label: 'Companion' },
    { key: 'settings', label: 'Settings' }
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-paper-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-8 py-3">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            StudyLens
          </div>
          <nav className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setRoute({ page: t.key })}
                className={`relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-paper-card text-ink shadow-card' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {t.label}
                {t.key === 'home' && live && <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-ink-soft" title={connected ? 'UNO Q connected' : 'UNO Q not connected'}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-ink-faint'}`} />
            UNO Q {connected ? 'connected' : 'offline'}
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          {route.page === 'home' && (
            <Home
              status={status}
              onOpenReport={(id) => setRoute({ page: 'report', id })}
              onNavigate={setRoute}
              touchStart={touchStart}
              onTouchStartHandled={() => setTouchStart(false)}
            />
          )}
          {route.page === 'history' && <History onOpen={(id) => setRoute({ page: 'report', id })} />}
          {route.page === 'companion' && <CompanionPage />}
          {route.page === 'settings' && <SettingsPage />}
          {route.page === 'report' && <Report id={route.id} onBack={() => setRoute({ page: 'history' })} />}
        </div>
      </main>
    </div>
  )
}

function Logo(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="rgb(var(--accent))" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.4" fill="#fff" />
    </svg>
  )
}
