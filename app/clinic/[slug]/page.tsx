import { getClinicBySlug } from '@/lib/clinic'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function SplashPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clinic = await getClinicBySlug(slug)
  if (!clinic) notFound()

  const color = clinic.primary_color || '#0EA5E9'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#F8FAFC;min-height:100vh}
        .page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px}
        .card{background:white;border-radius:20px;border:1px solid #E2E8F0;padding:48px 40px;width:100%;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.06)}
        .logo-wrap{width:68px;height:68px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:34px;margin:0 auto 20px}
        .clinic-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;margin-bottom:6px}
        .clinic-info{font-size:13px;color:#94A3B8;margin-bottom:4px}
        .divider{height:1px;background:#F1F5F9;margin:28px 0}
        .section-label{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#CBD5E1;margin-bottom:14px}
        .btn{display:block;width:100%;padding:13px 24px;border-radius:12px;font-size:15px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;text-decoration:none;text-align:center;transition:all .15s;margin-bottom:10px;border:none}
        .btn-primary{color:white}
        .btn-primary:hover{filter:brightness(0.92)}
        .btn-secondary{background:#F8FAFC;color:#475569;border:1.5px solid #E2E8F0!important}
        .btn-secondary:hover{background:#F1F5F9}
        .btn-ghost{background:none;border:none;color:#94A3B8;font-size:13px;margin-bottom:0;padding:8px;width:100%;cursor:pointer;font-family:'DM Sans',sans-serif;transition:color .15s;text-decoration:none;display:block;text-align:center}
        .btn-ghost:hover{color:#64748B}
        .footer{margin-top:28px;font-size:12px;color:#CBD5E1}
        .footer a{color:#94A3B8;text-decoration:none}
        .footer a:hover{color:#64748B}
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo-wrap" style={{ background: `${color}18` }}>🦷</div>
          <div className="clinic-name">{clinic.name}</div>
          {clinic.address && <div className="clinic-info">{clinic.address}</div>}
          {clinic.phone && <div className="clinic-info">{clinic.phone}</div>}

          <div className="divider" />

          <div className="section-label">Patient access</div>

          <Link
            href={`/clinic/${slug}/login?type=patient&mode=register`}
            className="btn btn-primary"
            style={{ background: color }}
          >
            Create an account
          </Link>

          <Link
            href={`/clinic/${slug}/login?type=patient`}
            className="btn btn-secondary"
          >
            Sign in
          </Link>

          <div className="divider" />

          <Link
            href={`/clinic/${slug}/login?type=staff`}
            className="btn-ghost"
          >
            Staff &amp; clinic owner login →
          </Link>
        </div>

        <div className="footer">
          Powered by <a href="https://dentplus.app" target="_blank">DentPlus</a>
        </div>
      </div>
    </>
  )
}
