'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PLANS = [
  { name: 'Starter', price: '$99', period: '/month', id: 'starter', color: '#0EA5E9',
    features: ['Up to 3 staff', '200 patients', 'AI booking agent', 'Patient portal', 'Email support'] },
  { name: 'Pro', price: '$199', period: '/month', id: 'pro', color: '#6366F1', popular: true,
    features: ['Up to 10 staff', '1,000 patients', 'AI booking + waitlist', 'SMS confirmations', 'Insurance pre-check', 'Priority support'] },
  { name: 'Enterprise', price: 'Custom', period: '', id: 'enterprise', color: '#10B981',
    features: ['Unlimited staff', 'Unlimited patients', 'All AI agents', 'Custom integrations', 'Dedicated support', 'SLA guarantee'] },
]

export default function BillingPage() {
  const [sub, setSub] = useState<{ plan: string; status: string; trial_ends_at: string; max_staff: number; max_patients: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: owner } = await supabase.from('clinic_owners').select('clinic_id').eq('auth_id', user.id).single()
      if (!owner) return
      const { data } = await supabase.from('subscriptions').select('*').eq('clinic_id', owner.clinic_id).single()
      setSub(data)
      setLoading(false)
    }
    load()
  }, [])

  const trialDaysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&display=swap');
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#0F172A;margin-bottom:4px}
        .page-sub{font-size:13px;color:#94A3B8;margin-bottom:28px}
        .current-plan{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:20px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between}
        .plan-label{font-size:11px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:#94A3B8;margin-bottom:4px}
        .plan-name{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#0F172A;text-transform:capitalize}
        .plan-status{font-size:12px;color:#64748B;margin-top:2px}
        .trial-badge{padding:6px 12px;background:#FEF3C7;border-radius:20px;font-size:12px;font-weight:600;color:#92400E}
        .plans-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .plan-card{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:24px;position:relative;transition:box-shadow .15s}
        .plan-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.08)}
        .plan-card.popular{border-width:2px}
        .popular-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);padding:3px 12px;border-radius:20px;font-size:10px;font-weight:700;color:white;white-space:nowrap;letter-spacing:.5px}
        .plan-title{font-size:16px;font-weight:600;color:#0F172A;margin-bottom:6px}
        .plan-price{font-family:'Syne',sans-serif;font-size:28px;font-weight:700;color:#0F172A;margin-bottom:16px}
        .plan-price span{font-size:14px;font-weight:400;color:#94A3B8}
        .features{list-style:none;margin-bottom:20px}
        .features li{font-size:13px;color:#475569;padding:4px 0;display:flex;align-items:center;gap:8px}
        .features li::before{content:'✓';font-weight:700;font-size:11px}
        .plan-btn{width:100%;padding:10px;border-radius:8px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;border:1.5px solid #E2E8F0;background:white;color:#475569;transition:all .15s}
        .plan-btn:hover{background:#F8FAFC}
        .plan-btn.primary{color:white;border-color:transparent}
        .plan-btn.primary:hover{filter:brightness(.92)}
        .coming-soon{text-align:center;padding:24px;color:#94A3B8;font-size:13px;margin-top:8px}
      `}</style>

      <div className="page-title">Billing</div>
      <div className="page-sub">Manage your subscription and plan</div>

      {!loading && sub && (
        <div className="current-plan">
          <div>
            <div className="plan-label">Current plan</div>
            <div className="plan-name">{sub.plan}</div>
            <div className="plan-status">
              {sub.plan === 'trial' && trialDaysLeft !== null
                ? `Trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining`
                : `Status: ${sub.status}`}
            </div>
          </div>
          {sub.plan === 'trial' && <div className="trial-badge">{trialDaysLeft} days left</div>}
        </div>
      )}

      <div className="plans-grid">
        {PLANS.map(plan => (
          <div key={plan.id} className={`plan-card ${plan.popular ? 'popular' : ''}`}
            style={plan.popular ? { borderColor: plan.color } : {}}>
            {plan.popular && <div className="popular-tag" style={{ background: plan.color }}>Most popular</div>}
            <div className="plan-title">{plan.name}</div>
            <div className="plan-price">{plan.price}<span>{plan.period}</span></div>
            <ul className="features">
              {plan.features.map(f => <li key={f}>{f}</li>)}
            </ul>
            <button className={`plan-btn ${plan.popular ? 'primary' : ''}`}
              style={plan.popular ? { background: plan.color } : {}}>
              {plan.id === 'enterprise' ? 'Contact us' : 'Choose plan'}
            </button>
          </div>
        ))}
      </div>

      <div className="coming-soon">
        Stripe integration coming soon. Contact us at hello@dentplus.app to upgrade.
      </div>
    </>
  )
}
