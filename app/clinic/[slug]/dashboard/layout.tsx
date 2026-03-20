'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const CLINIC_ID = process.env.NEXT_PUBLIC_DEMO_CLINIC_ID!

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pulse, setPulse] = useState(false)
  const [time, setTime] = useState('')

  const slug = pathname.split('/')[2] || 'demo'

  const NAV = [
    { icon: '▦', label: 'Overview', href: `/clinic/${slug}/dashboard` },
    { icon: '◈', label: 'Patients', href: `/clinic/${slug}/dashboard/patients` },
    { icon: '◷', label: 'Schedule', href: `/clinic/${slug}/dashboard/schedule` },
    { icon: '📋', label: 'Intake review', href: `/clinic/${slug}/dashboard/intake` },
    { icon: '⬡', label: 'AI Agent', href: `/clinic/${slug}/dashboard/agent` },
    { icon: '◎', label: 'Reports', href: `/clinic/${slug}/dashboard/reports` },
    { icon: '◉', label: 'Settings', href: `/clinic/${slug}/dashboard/settings` },
  ]

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-CA', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: 'America/Toronto'
    }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const p = setInterval(() => setPulse(v => !v), 2000)
    return () => clearInterval(p)
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F0F4F8; color: #0F172A; }
        .layout { display: flex; min-height: 100vh; }
        .sidebar {
          width: 240px; background: #0F172A;
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; height: 100vh; z-index: 50;
        }
        .logo-area { padding: 26px 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .logo-mark { display: flex; align-items: center; gap: 10px; margin-bottom: 3px; }
        .logo-icon { width: 30px; height: 30px; background: #0EA5E9; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .logo-text { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: #F8FAFC; letter-spacing: -0.3px; }
        .logo-sub { font-size: 11px; color: rgba(148,163,184,0.5); padding-left: 40px; }
        .clock { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: rgba(148,163,184,0.35); margin-top: 10px; letter-spacing: 1.5px; }
        .ai-status { margin: 12px 16px; padding: 8px 12px; background: rgba(14,165,233,0.07); border: 1px solid rgba(14,165,233,0.15); border-radius: 7px; display: flex; align-items: center; gap: 8px; }
        .ai-pulse { width: 6px; height: 6px; border-radius: 50%; background: #0EA5E9; flex-shrink: 0; transition: box-shadow 1s ease, opacity 1s ease; }
        .ai-pulse.on { box-shadow: 0 0 0 3px rgba(14,165,233,0.2); }
        .ai-pulse.off { opacity: 0.3; box-shadow: none; }
        .ai-status-text { font-size: 11px; color: #0EA5E9; font-weight: 500; letter-spacing: 0.3px; }
        .nav { padding: 8px 10px; flex: 1; }
        .nav-label { font-size: 9.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(148,163,184,0.25); padding: 12px 10px 6px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 7px; color: rgba(148,163,184,0.5); font-size: 13px; cursor: pointer; margin-bottom: 1px; transition: all 0.15s; border: none; background: none; width: 100%; text-align: left; font-family: 'DM Sans', sans-serif; position: relative; }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: #CBD5E1; }
        .nav-item.active { background: rgba(14,165,233,0.1); color: #0EA5E9; font-weight: 500; }
        .nav-item.active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 2px; height: 55%; background: #0EA5E9; border-radius: 0 2px 2px 0; }
        .nav-icon { font-size: 13px; width: 18px; text-align: center; }
        .widget-btn { margin: 0 12px 24px; padding: 10px 14px; background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.2); border-radius: 8px; color: #0EA5E9; font-size: 12px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
        .widget-btn:hover { background: rgba(14,165,233,0.14); }
        .widget-dot { width: 5px; height: 5px; border-radius: 50%; background: #0EA5E9; box-shadow: 0 0 6px rgba(14,165,233,0.8); }
        .main { flex: 1; margin-left: 240px; padding: 36px 40px; min-height: 100vh; }
      `}</style>

      <div className="layout">
        <aside className="sidebar">
          <div className="logo-area">
            <div className="logo-mark">
              <div className="logo-icon">🦷</div>
              <div className="logo-text">DentPlus</div>
            </div>
            <div className="logo-sub">Clinique Dentaire MTL</div>
            <div className="clock">{time || '00:00:00'}</div>
          </div>

          <div className="ai-status">
            <div className={`ai-pulse ${pulse ? 'on' : 'off'}`} />
            <div className="ai-status-text">AI Agent · Online</div>
          </div>

          <nav className="nav">
            <div className="nav-label">Workspace</div>
            {NAV.map(item => (
              <button
                key={item.href}
                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                onClick={() => router.push(item.href)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <button className="widget-btn" onClick={() => window.open(`/clinic/${slug}/book`, '_blank')}>
            <div className="widget-dot" />
            Open patient widget
          </button>
        </aside>

        <main className="main">{children}</main>
      </div>
    </>
  )
}
