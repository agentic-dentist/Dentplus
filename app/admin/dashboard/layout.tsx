'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { icon: '▦', label: 'Overview', href: '/admin/dashboard' },
  { icon: '◈', label: 'Clinic profile', href: '/admin/dashboard/profile' },
  { icon: '👥', label: 'Team', href: '/admin/dashboard/team' },
  { icon: '◎', label: 'Billing', href: '/admin/dashboard/billing' },
]

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [clinicName, setClinicName] = useState('')
  const [slug, setSlug] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [plan, setPlan] = useState('trial')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: owner } = await supabase
        .from('clinic_owners')
        .select('full_name, clinic_id, clinics(name)')
        .eq('auth_id', user.id)
        .single()

      if (!owner) { router.push('/admin/login'); return }

      const clinic = Array.isArray(owner.clinics) ? owner.clinics[0] : owner.clinics
      setOwnerName(owner.full_name)
      setClinicName((clinic as { name: string })?.name || '')

      const { data: settings } = await supabase
        .from('clinic_settings')
        .select('slug')
        .eq('clinic_id', owner.clinic_id)
        .single()

      if (settings) setSlug(settings.slug)

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('clinic_id', owner.clinic_id)
        .single()

      if (sub) setPlan(sub.plan)
    }
    load()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F8FAFC; color: #0F172A; }
        .layout { display: flex; min-height: 100vh; }
        .sidebar {
          width: 240px; background: #0F172A;
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; height: 100vh; z-index: 50;
        }
        .logo-area { padding: 24px 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .logo-mark { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .logo-icon { width: 30px; height: 30px; background: #0EA5E9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .logo-text { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; color: #F8FAFC; letter-spacing: -0.3px; }
        .logo-clinic { font-size: 12px; color: rgba(148,163,184,0.6); padding-left: 40px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .plan-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; background: rgba(14,165,233,0.15); color: #0EA5E9; margin-left: 40px; margin-top: 6px; }
        .nav { padding: 12px 10px; flex: 1; }
        .nav-label { font-size: 9.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(148,163,184,0.3); padding: 10px 10px 6px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 7px; color: rgba(148,163,184,0.55); font-size: 13px; cursor: pointer; margin-bottom: 1px; transition: all 0.15s; border: none; background: none; width: 100%; text-align: left; font-family: 'DM Sans', sans-serif; position: relative; }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: #CBD5E1; }
        .nav-item.active { background: rgba(14,165,233,0.1); color: #0EA5E9; font-weight: 500; }
        .nav-item.active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 2px; height: 55%; background: #0EA5E9; border-radius: 0 2px 2px 0; }
        .sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .owner-name { font-size: 13px; color: #CBD5E1; font-weight: 500; margin-bottom: 2px; }
        .signout { font-size: 12px; color: rgba(148,163,184,0.4); background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; transition: color 0.15s; }
        .signout:hover { color: #94A3B8; }
        .view-clinic { display: block; margin-top: 10px; padding: 8px 12px; background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.2); border-radius: 7px; font-size: 12px; color: #0EA5E9; text-decoration: none; text-align: center; transition: background 0.15s; }
        .view-clinic:hover { background: rgba(14,165,233,0.14); }
        .main { flex: 1; margin-left: 240px; padding: 36px 40px; min-height: 100vh; }
      `}</style>

      <div className="layout">
        <aside className="sidebar">
          <div className="logo-area">
            <div className="logo-mark">
              <div className="logo-icon">🦷</div>
              <div className="logo-text">DentPlus</div>
            </div>
            <div className="logo-clinic">{clinicName}</div>
            <div className="plan-badge">{plan}</div>
          </div>

          <nav className="nav">
            <div className="nav-label">Admin</div>
            {NAV.map(item => (
              <button
                key={item.href}
                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                onClick={() => router.push(item.href)}
              >
                <span style={{ fontSize: '13px', width: '18px', textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            {slug && (
              <a href={`/clinic/${slug}`} target="_blank" className="view-clinic">
                View clinic page →
              </a>
            )}
            <div className="owner-name" style={{ marginTop: '12px' }}>{ownerName}</div>
            <button className="signout" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        <main className="main">{children}</main>
      </div>
    </>
  )
}
