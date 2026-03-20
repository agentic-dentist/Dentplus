export default function SettingsPage() {
  return (
    <>
      <style>{`
        .page-title { font-size: 22px; font-weight: 700; color: #0F172A; letter-spacing: -0.3px; margin-bottom: 4px; }
        .page-sub { font-size: 13px; color: #64748B; margin-bottom: 24px; }
        .coming { background: white; border-radius: 12px; border: 1px solid #E2E8F0; padding: 64px; text-align: center; }
        .coming-icon { font-size: 48px; margin-bottom: 16px; }
        .coming-title { font-size: 18px; font-weight: 600; color: #0F172A; margin-bottom: 8px; }
        .coming-sub { font-size: 14px; color: #64748B; max-width: 320px; margin: 0 auto; line-height: 1.6; }
      `}</style>
      <div className="page-title">Settings</div>
      <div className="page-sub">Clinic configuration and preferences</div>
      <div className="coming">
        <div className="coming-icon">⚙️</div>
        <div className="coming-title">Coming soon</div>
        <div className="coming-sub">Manage clinic info, working hours, team members, and AI agent behaviour.</div>
      </div>
    </>
  )
}
