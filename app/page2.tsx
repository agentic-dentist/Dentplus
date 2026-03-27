import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DentPlus — The AI-Powered Dental Practice Platform',
  description: 'Replace your front desk with AI. Automated booking, waitlist management, patient intake, and reminders — 24/7, bilingual FR/EN. Built for Canadian dental clinics.',
}

export default function HomePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:       #080E1A;
          --surface:  #0F172A;
          --border:   rgba(255,255,255,.07);
          --teal:     #0EA5E9;
          --teal-dim: rgba(14,165,233,.15);
          --white:    #F8FAFC;
          --muted:    #64748B;
          --text:     #CBD5E1;
        }

        html { scroll-behavior: smooth; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: var(--text);
          overflow-x: hidden;
        }

        /* ── NAV ── */
        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 48px;
          background: rgba(8,14,26,.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .nav-logo {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 800;
          color: var(--white); letter-spacing: -.3px;
          text-decoration: none;
        }
        .nav-logo span { color: var(--teal); }
        .nav-links { display: flex; align-items: center; gap: 32px; }
        .nav-links a {
          font-size: 14px; color: var(--muted);
          text-decoration: none; transition: color .2s;
        }
        .nav-links a:hover { color: var(--white); }
        .nav-cta {
          padding: 9px 22px;
          background: var(--teal); color: white;
          border-radius: 8px; font-size: 14px; font-weight: 500;
          text-decoration: none; transition: all .2s;
          font-family: 'DM Sans', sans-serif;
        }
        .nav-cta:hover { background: #0284C7; transform: translateY(-1px); }

        /* ── HERO ── */
        .hero {
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 120px 24px 80px;
          position: relative; overflow: hidden;
          text-align: center;
        }
        .hero-glow {
          position: absolute; top: -200px; left: 50%;
          transform: translateX(-50%);
          width: 800px; height: 600px;
          background: radial-gradient(ellipse, rgba(14,165,233,.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(14,165,233,.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,165,233,.04) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%);
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 16px;
          background: var(--teal-dim);
          border: 1px solid rgba(14,165,233,.3);
          border-radius: 100px;
          font-size: 12px; font-weight: 500; color: var(--teal);
          margin-bottom: 28px; letter-spacing: .5px;
          text-transform: uppercase;
        }
        .hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--teal);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .5; transform: scale(.8); }
        }
        h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(42px, 7vw, 80px);
          font-weight: 800; line-height: 1.05;
          color: var(--white); letter-spacing: -2px;
          max-width: 900px; margin-bottom: 24px;
        }
        h1 em {
          font-style: normal; color: var(--teal);
          position: relative;
        }
        .hero-sub {
          font-size: clamp(16px, 2vw, 19px);
          font-weight: 300; color: var(--text);
          max-width: 580px; line-height: 1.7;
          margin-bottom: 44px;
        }
        .hero-sub strong { color: var(--white); font-weight: 500; }
        .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
        .btn-primary {
          padding: 14px 32px;
          background: var(--teal); color: white;
          border-radius: 10px; font-size: 15px; font-weight: 500;
          text-decoration: none; transition: all .2s;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 0 32px rgba(14,165,233,.3);
        }
        .btn-primary:hover { background: #0284C7; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(14,165,233,.4); }
        .btn-secondary {
          padding: 14px 32px;
          background: transparent; color: var(--white);
          border: 1px solid var(--border);
          border-radius: 10px; font-size: 15px; font-weight: 400;
          text-decoration: none; transition: all .2s;
          font-family: 'DM Sans', sans-serif;
        }
        .btn-secondary:hover { border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.04); }

        .hero-stats {
          display: flex; gap: 48px; margin-top: 72px;
          padding-top: 48px;
          border-top: 1px solid var(--border);
          flex-wrap: wrap; justify-content: center;
        }
        .hero-stat-val {
          font-family: 'Syne', sans-serif;
          font-size: 32px; font-weight: 700; color: var(--white);
          line-height: 1;
        }
        .hero-stat-val span { color: var(--teal); }
        .hero-stat-label { font-size: 13px; color: var(--muted); margin-top: 6px; }

        /* ── PROBLEM ── */
        .section {
          padding: 100px 24px;
          max-width: 1100px; margin: 0 auto;
        }
        .section-label {
          font-size: 11px; font-weight: 600;
          color: var(--teal); letter-spacing: 2px;
          text-transform: uppercase; margin-bottom: 16px;
        }
        h2 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 700; color: var(--white);
          letter-spacing: -1px; line-height: 1.15;
          margin-bottom: 16px;
        }
        .section-sub {
          font-size: 16px; color: var(--text);
          max-width: 560px; line-height: 1.7;
          font-weight: 300;
        }

        .problem-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 2px; margin-top: 56px;
          border-radius: 16px; overflow: hidden;
          border: 1px solid var(--border);
        }
        .problem-card {
          background: var(--surface);
          padding: 32px;
        }
        .problem-card.highlight { background: var(--teal-dim); }
        .problem-year {
          font-family: 'Syne', sans-serif;
          font-size: 48px; font-weight: 800;
          color: var(--border); line-height: 1;
          margin-bottom: 12px;
        }
        .problem-card.highlight .problem-year { color: rgba(14,165,233,.3); }
        .problem-title {
          font-size: 18px; font-weight: 600;
          color: var(--white); margin-bottom: 8px;
        }
        .problem-desc { font-size: 14px; color: var(--muted); line-height: 1.6; }
        .problem-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
        .problem-tag {
          padding: 4px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 500;
          background: rgba(255,255,255,.05); color: var(--muted);
        }
        .problem-tag.good {
          background: rgba(14,165,233,.12); color: var(--teal);
        }

        /* ── FEATURES ── */
        .features-section {
          padding: 100px 24px;
          background: var(--surface);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .features-inner { max-width: 1100px; margin: 0 auto; }
        .features-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; margin-top: 56px;
          background: var(--border);
          border-radius: 16px; overflow: hidden;
        }
        .feature-card {
          background: var(--surface);
          padding: 36px 32px;
          transition: background .2s;
        }
        .feature-card:hover { background: rgba(14,165,233,.04); }
        .feature-icon {
          width: 44px; height: 44px;
          background: var(--teal-dim);
          border: 1px solid rgba(14,165,233,.2);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; margin-bottom: 20px;
        }
        .feature-title {
          font-family: 'Syne', sans-serif;
          font-size: 17px; font-weight: 700;
          color: var(--white); margin-bottom: 10px;
        }
        .feature-desc { font-size: 14px; color: var(--muted); line-height: 1.65; }

        /* ── HOW IT WORKS ── */
        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-top: 56px; }
        .step { position: relative; }
        .step-num {
          font-family: 'Syne', sans-serif;
          font-size: 64px; font-weight: 800;
          color: rgba(14,165,233,.08); line-height: 1;
          margin-bottom: -16px;
        }
        .step-title { font-size: 17px; font-weight: 600; color: var(--white); margin-bottom: 8px; }
        .step-desc { font-size: 14px; color: var(--muted); line-height: 1.65; }

        /* ── BILINGUAL ── */
        .bilingual-section {
          padding: 80px 24px;
          max-width: 1100px; margin: 0 auto;
        }
        .bilingual-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px; padding: 56px;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 48px; align-items: center;
        }
        .bilingual-chat {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px; padding: 24px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .chat-msg {
          padding: 10px 14px; border-radius: 10px;
          font-size: 13px; line-height: 1.5; max-width: 85%;
        }
        .chat-msg.bot {
          background: var(--teal-dim);
          border: 1px solid rgba(14,165,233,.15);
          color: var(--text);
        }
        .chat-msg.user {
          background: rgba(255,255,255,.05);
          color: var(--text); align-self: flex-end;
        }
        .chat-lang {
          font-size: 10px; font-weight: 600;
          color: var(--teal); letter-spacing: 1px;
          text-transform: uppercase; margin-bottom: 8px;
        }

        /* ── PRICING ── */
        .pricing-section {
          padding: 100px 24px;
          background: var(--surface);
          border-top: 1px solid var(--border);
        }
        .pricing-inner { max-width: 900px; margin: 0 auto; text-align: center; }
        .pricing-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 16px; margin-top: 48px; text-align: left;
        }
        .pricing-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 16px; padding: 32px;
          position: relative; transition: border-color .2s;
        }
        .pricing-card:hover { border-color: rgba(14,165,233,.3); }
        .pricing-card.featured {
          border-color: var(--teal);
          background: var(--teal-dim);
        }
        .pricing-plan {
          font-size: 12px; font-weight: 600;
          color: var(--muted); letter-spacing: 1px;
          text-transform: uppercase; margin-bottom: 12px;
        }
        .pricing-card.featured .pricing-plan { color: var(--teal); }
        .pricing-price {
          font-family: 'Syne', sans-serif;
          font-size: 36px; font-weight: 800;
          color: var(--white); line-height: 1;
          margin-bottom: 4px;
        }
        .pricing-price sup { font-size: 18px; vertical-align: super; }
        .pricing-period { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
        .pricing-features { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .pricing-features li {
          font-size: 13px; color: var(--text);
          display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;
        }
        .pricing-features li::before { content: '✓'; color: var(--teal); font-weight: 700; flex-shrink: 0; }
        .pricing-btn {
          display: block; width: 100%;
          padding: 11px; margin-top: 28px;
          text-align: center; border-radius: 8px;
          font-size: 14px; font-weight: 500;
          text-decoration: none; transition: all .2s;
          font-family: 'DM Sans', sans-serif;
          border: 1px solid var(--border);
          color: var(--white); background: transparent;
        }
        .pricing-btn:hover { border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.05); }
        .pricing-card.featured .pricing-btn {
          background: var(--teal); border-color: var(--teal); color: white;
        }
        .pricing-card.featured .pricing-btn:hover { background: #0284C7; }
        .pricing-badge {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          padding: 4px 14px; background: var(--teal);
          border-radius: 100px; font-size: 11px; font-weight: 600; color: white;
          white-space: nowrap;
        }

        /* ── CTA ── */
        .cta-section {
          padding: 100px 24px; text-align: center;
          position: relative; overflow: hidden;
        }
        .cta-glow {
          position: absolute; bottom: -100px; left: 50%;
          transform: translateX(-50%);
          width: 600px; height: 400px;
          background: radial-gradient(ellipse, rgba(14,165,233,.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .cta-inner { max-width: 600px; margin: 0 auto; position: relative; }
        .cta-pipeda {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px;
          background: rgba(16,185,129,.1);
          border: 1px solid rgba(16,185,129,.2);
          border-radius: 100px;
          font-size: 12px; color: #10B981; margin-bottom: 24px;
        }

        /* ── FOOTER ── */
        footer {
          padding: 32px 48px;
          border-top: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 16px;
        }
        .footer-logo {
          font-family: 'Syne', sans-serif;
          font-size: 16px; font-weight: 700; color: var(--white);
          text-decoration: none;
        }
        .footer-logo span { color: var(--teal); }
        .footer-links { display: flex; gap: 24px; }
        .footer-links a { font-size: 13px; color: var(--muted); text-decoration: none; }
        .footer-links a:hover { color: var(--white); }
        .footer-copy { font-size: 12px; color: var(--muted); }

        @media (max-width: 768px) {
          nav { padding: 16px 24px; }
          .nav-links { display: none; }
          .problem-grid { grid-template-columns: 1fr; }
          .features-grid { grid-template-columns: 1fr; }
          .steps { grid-template-columns: 1fr; }
          .bilingual-card { grid-template-columns: 1fr; }
          .pricing-grid { grid-template-columns: 1fr; }
          footer { flex-direction: column; text-align: center; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav>
        <a href="/" className="nav-logo">Dent<span>Plus</span></a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="/clinic/demo">Live demo</a>
        </div>
        <a href="/clinic/demo/portal" className="nav-cta">Try the demo</a>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-grid" />
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Now available in Québec — FR/EN bilingual
        </div>
        <h1>Your dental practice,<br /><em>running itself.</em></h1>
        <p className="hero-sub">
          DentPlus replaces your front desk with an AI agent that handles
          <strong> booking, cancellations, waitlists, intake, and reminders</strong> —
          24/7, without lifting a finger.
        </p>
        <div className="hero-actions">
          <a href="/clinic/demo" className="btn-primary">See it live →</a>
          <a href="#pricing" className="btn-secondary">View pricing</a>
        </div>
        <div className="hero-stats">
          <div>
            <div className="hero-stat-val">24<span>/7</span></div>
            <div className="hero-stat-label">AI receptionist uptime</div>
          </div>
          <div>
            <div className="hero-stat-val">2<span>min</span></div>
            <div className="hero-stat-label">Avg booking time</div>
          </div>
          <div>
            <div className="hero-stat-val">0<span> staff</span></div>
            <div className="hero-stat-label">Needed for front desk</div>
          </div>
          <div>
            <div className="hero-stat-val">FR<span>/EN</span></div>
            <div className="hero-stat-label">Fully bilingual</div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <div style={{ padding: '0 24px 100px', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="section-label">The problem</div>
        <h2>Dentrix was built in 1989.</h2>
        <p className="section-sub">The most-used dental software in Canada runs locally on office computers, has no cloud, no AI, and no patient portal. It hasn't fundamentally changed in 35 years.</p>
        <div className="problem-grid">
          <div className="problem-card">
            <div className="problem-year">1989</div>
            <div className="problem-title">Dentrix — The incumbent</div>
            <div className="problem-desc">Local install. Windows-only. Manual booking. Phone-only intake. No patient portal. No AI. No automation. Front desk required 9–5.</div>
            <div className="problem-tags">
              <span className="problem-tag">Local install</span>
              <span className="problem-tag">Phone booking only</span>
              <span className="problem-tag">Manual reminders</span>
              <span className="problem-tag">English only</span>
              <span className="problem-tag">No patient portal</span>
            </div>
          </div>
          <div className="problem-card highlight">
            <div className="problem-year">2026</div>
            <div className="problem-title">DentPlus — Built for now</div>
            <div className="problem-desc">Cloud-native. AI booking agent. Automated waitlist. Digital intake. Patient portal. Bilingual. Reminders sent automatically. Zero front desk required.</div>
            <div className="problem-tags">
              <span className="problem-tag good">Cloud + AI</span>
              <span className="problem-tag good">24/7 booking</span>
              <span className="problem-tag good">Auto reminders</span>
              <span className="problem-tag good">FR/EN bilingual</span>
              <span className="problem-tag good">Patient portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="features-section" id="features">
        <div className="features-inner">
          <div className="section-label">What's included</div>
          <h2>Everything your front desk does, automated.</h2>
          <p className="section-sub">One platform. No integrations. No training. Ready in 10 minutes.</p>
          <div className="features-grid">
            {[
              { icon: '🤖', title: 'AI Booking Agent', desc: 'Patients chat in French or English. The AI books, cancels, and reschedules appointments around the clock — no human needed.' },
              { icon: '⚡', title: 'Smart Waitlist', desc: 'When a cancellation happens, the Matchmaker automatically finds the best-fit patient from the waitlist and offers them the slot.' },
              { icon: '📋', title: 'Digital Intake', desc: 'Patients complete their medical history, dental history, insurance, and consent forms online before they even arrive.' },
              { icon: '🔔', title: 'Automated Reminders', desc: '48h and 24h reminders sent automatically by SMS or email. Patients confirm attendance with one tap.' },
              { icon: '🦷', title: 'Treatment Notes', desc: 'Dentists write clinical notes directly on the appointment. Notes attach to the visit and are available to the patient in their portal.' },
              { icon: '→', title: 'Specialist Referrals', desc: 'Send referrals to specialists in seconds. Every referral to a non-DentPlus clinic generates a growth lead automatically.' },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <div className="section" id="how-it-works">
        <div className="section-label">How it works</div>
        <h2>Up and running in 10 minutes.</h2>
        <p className="section-sub">No migration, no training, no IT department required.</p>
        <div className="steps">
          {[
            { n: '01', title: 'Create your clinic', desc: 'Sign up, enter your clinic name, and invite your staff. Your AI agent is live immediately at yourclinic.dentplus.ca.' },
            { n: '02', title: 'Patients book themselves', desc: 'Share your clinic link. Patients chat with the AI to book, cancel, or join the waitlist — 24/7, in their language.' },
            { n: '03', title: 'You just treat patients', desc: 'Check your schedule each morning. Every appointment is confirmed, every intake form is filled. Just walk in and work.' },
          ].map(s => (
            <div key={s.n} className="step">
              <div className="step-num">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BILINGUAL ── */}
      <div className="bilingual-section">
        <div className="bilingual-card">
          <div>
            <div className="section-label">Built for Québec</div>
            <h2>Fully bilingual.<br />French-first.</h2>
            <p className="section-sub" style={{ marginBottom: '24px' }}>
              DentPlus speaks both official languages natively. Patients choose their language, and the AI responds accordingly — no configuration needed. Law 25 and PIPEDA compliant.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {['PIPEDA compliant', 'Loi 25 ready', 'Canadian data', 'FR/EN native'].map(tag => (
                <span key={tag} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: 'rgba(14,165,233,.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,.2)' }}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="bilingual-chat">
            <div className="chat-lang">🇫🇷 Français</div>
            <div className="chat-msg bot">Bonjour! Je suis l'assistante de Clinique Dentaire Montréal. Comment puis-je vous aider aujourd'hui?</div>
            <div className="chat-msg user">Je voudrais prendre un rendez-vous pour un nettoyage.</div>
            <div className="chat-msg bot">Bien sûr! Avez-vous une préférence de date ou d'heure pour votre nettoyage?</div>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
            <div className="chat-lang">🇨🇦 English</div>
            <div className="chat-msg bot">Hi! I'm the assistant for Clinique Dentaire Montréal. How can I help you today?</div>
            <div className="chat-msg user">I'd like to book a cleaning.</div>
            <div className="chat-msg bot">Of course! Do you have a preferred date or time for your cleaning?</div>
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <section className="pricing-section" id="pricing">
        <div className="pricing-inner">
          <div className="section-label">Pricing</div>
          <h2>Simple, predictable pricing.</h2>
          <p className="section-sub" style={{ margin: '0 auto 0', textAlign: 'center' }}>Start free. Upgrade when you're ready. No setup fees, no contracts.</p>
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-plan">Starter</div>
              <div className="pricing-price"><sup>$</sup>99</div>
              <div className="pricing-period">per month · CAD</div>
              <ul className="pricing-features">
                <li>AI booking agent</li>
                <li>Patient portal</li>
                <li>Digital intake forms</li>
                <li>Automated reminders</li>
                <li>Up to 3 staff accounts</li>
                <li>Email support</li>
              </ul>
              <a href="/clinic/demo" className="pricing-btn">Start free trial</a>
            </div>
            <div className="pricing-card featured">
              <div className="pricing-badge">Most popular</div>
              <div className="pricing-plan">Pro</div>
              <div className="pricing-price"><sup>$</sup>249</div>
              <div className="pricing-period">per month · CAD</div>
              <ul className="pricing-features">
                <li>Everything in Starter</li>
                <li>Smart waitlist + Matchmaker</li>
                <li>Treatment notes</li>
                <li>Specialist referrals</li>
                <li>Unlimited staff accounts</li>
                <li>SMS reminders (Twilio)</li>
                <li>Priority support</li>
              </ul>
              <a href="/clinic/demo" className="pricing-btn">Start free trial</a>
            </div>
            <div className="pricing-card">
              <div className="pricing-plan">Enterprise</div>
              <div className="pricing-price"><sup>$</sup>499</div>
              <div className="pricing-period">per month · CAD</div>
              <ul className="pricing-features">
                <li>Everything in Pro</li>
                <li>Multi-location support</li>
                <li>X-ray viewer</li>
                <li>Custom subdomain</li>
                <li>SLA guarantee</li>
                <li>Dedicated onboarding</li>
              </ul>
              <a href="mailto:hello@dentplus.ca" className="pricing-btn">Contact us</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="cta-glow" />
        <div className="cta-inner">
          <div className="cta-pipeda">🇨🇦 Canadian data residency · PIPEDA compliant</div>
          <h2>Ready to run your practice on autopilot?</h2>
          <p className="section-sub" style={{ margin: '16px auto 36px', textAlign: 'center' }}>
            Join the waitlist. First 10 clinics get 3 months free.
          </p>
          <div className="hero-actions">
            <a href="/clinic/demo" className="btn-primary">Try the live demo →</a>
            <a href="mailto:hello@dentplus.ca" className="btn-secondary">Book a call</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <a href="/" className="footer-logo">Dent<span>Plus</span></a>
        <div className="footer-links">
          <a href="/clinic/demo">Demo</a>
          <a href="#pricing">Pricing</a>
          <a href="mailto:hello@dentplus.ca">Contact</a>
          <a href="/clinic/demo/portal">Patient portal</a>
        </div>
        <div className="footer-copy">© 2026 DentPlus · Montréal, QC · Built for Canadian dental clinics</div>
      </footer>
    </>
  )
}
