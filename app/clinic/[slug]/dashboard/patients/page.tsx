'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Patient {
  id: string
  full_name: string
  phone: string
  email: string
  insurance_provider: string
  created_at: string
  is_active: boolean
}

const CLINIC_ID = process.env.NEXT_PUBLIC_DEMO_CLINIC_ID!

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const db = createClient()
    db.from('patients')
      .select('*')
      .eq('clinic_id', CLINIC_ID)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPatients(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = patients.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  )

  const initials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <>
      <style>{`
        .page-title { font-size: 22px; font-weight: 700; color: #0F172A; letter-spacing: -0.3px; margin-bottom: 4px; }
        .page-sub { font-size: 13px; color: #64748B; margin-bottom: 24px; }
        .toolbar { display: flex; gap: 12px; margin-bottom: 20px; }
        .search {
          flex: 1; padding: 10px 14px; border: 1.5px solid #E2E8F0;
          border-radius: 8px; font-size: 14px; font-family: 'DM Sans', sans-serif;
          outline: none; color: #1E293B;
        }
        .search:focus { border-color: #0F766E; }
        .table-wrap { background: white; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th {
          text-align: left; padding: 12px 16px;
          font-size: 11px; font-weight: 600; color: #64748B;
          text-transform: uppercase; letter-spacing: 0.5px;
          background: #F8FAFC; border-bottom: 1px solid #E2E8F0;
        }
        td { padding: 14px 16px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #F8FAFC; }
        .patient-cell { display: flex; align-items: center; gap: 10px; }
        .avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: #CCFBF1; color: #0F766E;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .patient-name { font-weight: 600; color: #0F172A; }
        .patient-email { font-size: 12px; color: #64748B; margin-top: 1px; }
        .badge {
          display: inline-block; padding: 3px 9px; border-radius: 20px;
          font-size: 11px; font-weight: 600;
          background: #F0FDFA; color: #0F766E;
        }
        .empty { padding: 48px; text-align: center; color: #94A3B8; font-size: 14px; }
      `}</style>

      <div className="page-title">Patients</div>
      <div className="page-sub">{patients.length} active patients at this clinic</div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search by name, email or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty">Loading patients...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No patients found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Phone</th>
                <th>Insurance</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="patient-cell">
                      <div className="avatar">{initials(p.full_name)}</div>
                      <div>
                        <div className="patient-name">{p.full_name}</div>
                        <div className="patient-email">{p.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.phone || '—'}</td>
                  <td>
                    {p.insurance_provider
                      ? <span className="badge">{p.insurance_provider}</span>
                      : <span style={{ color: '#94A3B8' }}>—</span>
                    }
                  </td>
                  <td style={{ color: '#64748B' }}>
                    {new Date(p.created_at).toLocaleDateString('en-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
