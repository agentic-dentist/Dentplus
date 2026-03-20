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
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F8FAFC; min-height: 100vh; }

        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
        }

        .card {
          background: white;
          border-radius: 20px;
          border: 1px solid #E2E8F0;
          padding: 48px 40px;
          width: 100%;
          max-width: 420px;
          text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }

        .logo-wrap {
          width: 64px; height: 64px;
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          font-size: 32px;
          margin: 0 auto 20px;
        }

        .clinic-name {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #0F172A;
          letter-spacing: -0.3px;
          margin-bottom: 6px;
        }

        .clinic-address {
          font-size: 13px;
          color: #94A3B8;
          margin-bottom: 32px;
        }

        .divider {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #CBD5E1;
          margin-bottom: 20px;
        }

        .btn {
          display: block;
          width: 100%;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s;
          margin-bottom: 12px;
        }

        .btn-primary {
          color: white;
          border: none;
        }
        .btn-primary:hover { filter: brightness(0.92); }

        .btn-secondary {
          background: #F8FAFC;
          color: #475569;
          border: 1.5px solid #E2E8F0;
        }
        .btn-secondary:hover { background: #F1F5F9; border-color: #CBD5E1; }

        .btn-ghost {
          background: none;
          border: none;
          color: #94A3B8;
          font-size: 13px;
          margin-bottom: 0;
          padding: 8px;
        }
        .btn-ghost:hover { color: #64748B; }

        .footer {
          margin-top: 32px;
          font-size: 12px;
          color: #CBD5E1;
        }
        .footer a { color: #94A3B8; text-decoration: none; }
        .footer a:hover { color: #64748B; }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo-wrap" style={{ background: `${color}18` }}>
            🦷
          </div>

          <div className="clinic-name">{clinic.name}</div>
          {clinic.address && (
            <div className="clinic-address">{clinic.address}</div>
          )}

          <div className="divider">Welcome — how can we help?</div>

          <Link
            href={`/clinic/${slug}/portal`}
            className="btn btn-primary"
            style={{ background: color }}
          >
            I am a patient
          </Link>

          <Link
            href={`/clinic/${slug}/book`}
            className="btn btn-secondary"
          >
            Book an appointment
          </Link>

          <Link
            href={`/clinic/${slug}/login?type=staff`}
            className="btn btn-ghost"
          >
            Clinic staff login →
          </Link>
        </div>

        <div className="footer">
          Powered by <a href="https://dentplus.app" target="_blank">DentPlus</a>
        </div>
      </div>
    </>
  )
}
