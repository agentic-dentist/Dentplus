import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DentPlus — The AI-Powered Dental Practice Platform',
  description: 'Replace your front desk with AI. Automated booking, SMS reminders, insurance-aware recall, and patient intake — 24/7, bilingual FR/EN. Built for Canadian dental clinics.',
}

export default function HomePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --teal: #00C4A7;
          --teal-dark: #009E87;
          --teal-light: #E6FAF7;
          --teal-mid: #CCFAF3;
          --teal-border: rgba(0,196,167,0.25);
          --black: #0A0F1A;
          --text: #1A2236;
          --muted: #6B7A99;
          --light-muted: #94A3B8;
          --bg: #F8FAFB;
          --white: #FFFFFF;
          --border: #E2E8F0;
          --border-strong: #CBD5E1;
          --surface: #F1F5F9;
        }
        html { scroll-behavior: smooth; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: var(--text);
          line-height: 1.6;
          overflow-x: hidden;
        }
        /* NAV */
        nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 64px; height: 68px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .nav-logo-icon { width: 34px; height: 34px; background: var(--teal); border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 17px; }
        .nav-logo-text { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: var(--black); }
        .nav-links { display: flex; gap: 36px; }
        .nav-links a { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color .15s; }
        .nav-links a:hover { color: var(--black); }
        .nav-right { display: flex; gap: 10px; align-items: center; }
        .btn-nav-ghost { padding: 8px 18px; background: none; border: 1.5px solid var(--border); border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text); font-family: 'DM Sans', sans-serif; transition: all .15s; text-decoration: none; display: inline-block; }
        .btn-nav-ghost:hover { border-color: var(--teal); color: var(--teal-dark); }
        .btn-nav-solid { padding: 8px 20px; background: var(--teal); border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: white; font-family: 'DM Sans', sans-serif; transition: all .15s; text-decoration: none; display: inline-block; }
        .btn-nav-solid:hover { background: var(--teal-dark); }
        /* HERO */
        .hero { padding: 100px 64px 0; max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; min-height: calc(100vh - 68px); }
        .hero-left { padding-bottom: 80px; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border: 1.5px solid var(--teal-border); background: var(--teal-light); border-radius: 20px; font-size: 12px; color: var(--teal-dark); font-weight: 600; margin-bottom: 32px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px; }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); animation: blink 2s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        h1 { font-family: 'Syne', sans-serif; font-size: clamp(42px, 5.5vw, 68px); font-weight: 800; line-height: 1.04; letter-spacing: -2.5px; margin-bottom: 22px; color: var(--black); }
        h1 .accent { color: var(--teal); }
        .hero-sub { font-size: 17px; color: var(--muted); line-height: 1.75; max-width: 480px; margin-bottom: 40px; }
        .hero-actions { display: flex; gap: 12px; margin-bottom: 52px; flex-wrap: wrap; }
        .btn-primary { padding: 14px 28px; background: var(--teal); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all .2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
        .btn-primary:hover { background: var(--teal-dark); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,196,167,0.3); }
        .btn-ghost { padding: 14px 28px; background: white; color: var(--text); border: 1.5px solid var(--border); border-radius: 10px; font-size: 15px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all .2s; text-decoration: none; display: inline-block; }
        .btn-ghost:hover { border-color: var(--border-strong); }
        .hero-stats { display: flex; gap: 44px; padding-top: 44px; border-top: 1px solid var(--border); }
        .stat-num { font-family: 'Syne', sans-serif; font-size: 30px; font-weight: 800; color: var(--black); line-height: 1; }
        .stat-num span { color: var(--teal); }
        .stat-label { font-size: 12px; color: var(--muted); margin-top: 4px; }
        /* MOCKUP */
        .hero-right { padding-bottom: 80px; }
        .mockup-wrap { background: white; border-radius: 20px; border: 1px solid var(--border); box-shadow: 0 32px 80px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04); overflow: hidden; }
        .mockup-topbar { padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
        .m-dot { width: 10px; height: 10px; border-radius: 50%; }
        .m-url { margin-left: 8px; flex: 1; background: white; border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; font-size: 11px; color: var(--light-muted); font-family: 'JetBrains Mono', monospace; }
        .mockup-body { padding: 20px; }
        .m-header { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--black); margin-bottom: 16px; }
        .m-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px; }
        .m-stat { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
        .m-stat-label { font-size: 10px; color: var(--light-muted); font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
        .m-stat-val { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--black); }
        .m-stat-val.teal { color: var(--teal); }
        .m-appts-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 10px; }
        .m-appt { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; }
        .m-appt-color { width: 4px; height: 32px; border-radius: 2px; background: var(--teal); flex-shrink: 0; }
        .m-appt-color.orange { background: #F59E0B; }
        .m-appt-color.blue { background: #6366F1; }
        .m-appt-name { font-size: 13px; font-weight: 600; color: var(--black); }
        .m-appt-meta { font-size: 11px; color: var(--muted); margin-top: 1px; font-family: 'JetBrains Mono', monospace; }
        .m-appt-badge { margin-left: auto; padding: 3px 9px; border-radius: 20px; font-size: 10px; font-weight: 600; }
        .m-appt-badge.confirmed { background: var(--teal-light); color: var(--teal-dark); }
        .m-appt-badge.pending { background: #FEF3C7; color: #D97706; }
        .m-ai-strip { margin-top: 12px; padding: 10px 14px; background: var(--teal-light); border: 1px solid var(--teal-border); border-radius: 10px; display: flex; align-items: center; gap: 10px; }
        .ai-chip { background: var(--teal); color: white; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
        .ai-strip-text { font-size: 11px; color: var(--teal-dark); font-weight: 500; }
        .ai-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); margin-left: auto; flex-shrink: 0; animation: blink 1.5s ease-in-out infinite; }
        /* LOGOS */
        .logos-bar { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 32px 64px; background: white; display: flex; align-items: center; gap: 48px; overflow: hidden; }
        .logos-label { font-size: 11px; color: var(--light-muted); white-space: nowrap; font-family: 'JetBrains Mono', monospace; letter-spacing: 1.5px; text-transform: uppercase; }
        .logos-items { display: flex; gap: 40px; align-items: center; flex-wrap: wrap; }
        .logo-item { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--border-strong); letter-spacing: -0.3px; }
        /* FEATURES */
        .features { padding: 120px 64px; max-width: 1280px; margin: 0 auto; }
        .section-tag { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--teal-dark); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
        .section-tag::before { content: ''; width: 20px; height: 1.5px; background: var(--teal); }
        .section-title { font-family: 'Syne', sans-serif; font-size: clamp(30px, 4vw, 46px); font-weight: 800; letter-spacing: -1.5px; line-height: 1.1; margin-bottom: 14px; color: var(--black); }
        .section-sub { font-size: 16px; color: var(--muted); max-width: 480px; margin-bottom: 60px; line-height: 1.7; }
        .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .feat-card { background: white; border: 1.5px solid var(--border); border-radius: 16px; padding: 32px; transition: all .2s; }
        .feat-card:hover { border-color: var(--teal-border); box-shadow: 0 8px 32px rgba(0,196,167,0.08); transform: translateY(-2px); }
        .feat-icon-wrap { width: 44px; height: 44px; border-radius: 10px; background: var(--teal-light); border: 1px solid var(--teal-border); display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 18px; }
        .feat-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: var(--black); margin-bottom: 9px; }
        .feat-desc { font-size: 13px; color: var(--muted); line-height: 1.75; }
        /* HOW IT WORKS */
        .how { padding: 100px 64px; background: white; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .how-inner { max-width: 1280px; margin: 0 auto; }
        .how-steps { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: var(--border); border-radius: 16px; overflow: hidden; margin-top: 60px; }
        .how-step { background: white; padding: 32px 28px; }
        .how-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--teal-dark); font-weight: 600; letter-spacing: 1px; margin-bottom: 14px; background: var(--teal-light); display: inline-block; padding: 3px 9px; border-radius: 20px; }
        .how-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--black); margin-bottom: 8px; }
        .how-desc { font-size: 13px; color: var(--muted); line-height: 1.7; }
        /* CONTACT / PRICING */
        .pricing { padding: 120px 64px; max-width: 1280px; margin: 0 auto; }
        .contact-card { background: white; border: 1.5px solid var(--border); border-radius: 20px; overflow: hidden; }
        .contact-card-top { padding: 44px 48px; border-bottom: 1px solid var(--border); }
        .contact-features { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 48px; }
        .cf-col { display: flex; flex-direction: column; gap: 14px; }
        .cf-item { font-size: 14px; color: var(--text); display: flex; align-items: center; gap: 10px; }
        .cf-check { color: var(--teal); font-weight: 700; font-size: 15px; flex-shrink: 0; }
        .contact-card-bottom { padding: 36px 48px; background: var(--teal-light); display: flex; align-items: center; gap: 32px; flex-wrap: wrap; }
        .contact-tagline { font-size: 14px; color: var(--teal-dark); font-style: italic; line-height: 1.6; flex: 1; min-width: 220px; }
        .btn-contact { padding: 14px 28px; background: var(--teal); color: white; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; font-family: 'DM Sans', sans-serif; transition: all .2s; white-space: nowrap; display: inline-block; }
        .btn-contact:hover { background: var(--teal-dark); transform: translateY(-1px); }
        .contact-note { font-size: 12px; color: var(--muted); width: 100%; margin-top: -20px; }
        /* CTA */
        .cta-wrap { padding: 0 64px 120px; max-width: 1280px; margin: 0 auto; }
        .cta-box { background: var(--teal); border-radius: 24px; padding: 80px 72px; display: grid; grid-template-columns: 1fr auto; gap: 60px; align-items: center; position: relative; overflow: hidden; }
        .cta-box::before { content: ''; position: absolute; right: -80px; top: -80px; width: 320px; height: 320px; border-radius: 50%; background: rgba(255,255,255,0.07); }
        .cta-box::after { content: ''; position: absolute; right: 80px; bottom: -100px; width: 200px; height: 200px; border-radius: 50%; background: rgba(255,255,255,0.05); }
        .cta-title { font-family: 'Syne', sans-serif; font-size: 42px; font-weight: 800; color: white; letter-spacing: -1.5px; line-height: 1.08; }
        .cta-sub { font-size: 16px; color: rgba(255,255,255,0.7); margin-top: 12px; }
        .cta-right { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; position: relative; z-index: 1; }
        .btn-cta-white { padding: 14px 28px; background: white; color: var(--teal-dark); border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; transition: all .2s; text-decoration: none; display: inline-block; }
        .btn-cta-white:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .cta-note { font-size: 13px; color: rgba(255,255,255,0.6); }
        /* FOOTER */
        footer { background: var(--black); padding: 64px 64px 40px; }
        .footer-top { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 48px; }
        .footer-brand { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
        .footer-brand-icon { width: 30px; height: 30px; background: var(--teal); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .footer-brand-text { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: white; }
        .footer-tagline { font-size: 13px; color: rgba(255,255,255,0.35); line-height: 1.7; max-width: 240px; }
        .footer-col-h { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; font-family: 'JetBrains Mono', monospace; }
        .footer-links-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .footer-links-list a { font-size: 13px; color: rgba(255,255,255,0.5); text-decoration: none; transition: color .15s; }
        .footer-links-list a:hover { color: white; }
        .footer-bottom { border-top: 1px solid rgba(255,255,255,0.07); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; }
        .footer-copy { font-size: 12px; color: rgba(255,255,255,0.25); font-family: 'JetBrains Mono', monospace; }
        /* RESPONSIVE */
        @media (max-width: 1100px) {
          nav { padding: 0 30px; }
          .hero { grid-template-columns: 1fr; padding: 60px 30px 0; }
          .hero-right { display: none; }
          .nav-links { display: none; }
          .features { padding: 80px 30px; }
          .how { padding: 80px 30px; }
          .pricing { padding: 80px 30px; }
          .cta-wrap { padding: 0 30px 80px; }
          .logos-bar { padding: 28px 30px; }
          footer { padding: 48px 30px 32px; }
        }
        @media (max-width: 800px) {
          .features-grid { grid-template-columns: 1fr; }
          .how-steps { grid-template-columns: 1fr; border-radius: 0; }
          .contact-features { grid-template-columns: 1fr; }
          .footer-top { grid-template-columns: 1fr 1fr; }
          .cta-box { grid-template-columns: 1fr; padding: 48px 32px; }
          .cta-right { align-items: flex-start; }
          .cta-title { font-size: 32px; }
          h1 { letter-spacing: -1.5px; }
          .hero-stats { flex-wrap: wrap; gap: 24px; }
        }
      `}</style>

      {/* NAV */}
      <nav>
        <a href="/" className="nav-logo">
          <div className="nav-logo-icon">🦷</div>
          <div className="nav-logo-text">DentPlus</div>
        </a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="https://demo.dentplus.ca" target="_blank" rel="noreferrer">Demo</a>
          <a href="#contact">Pricing</a>
        </div>
        <div className="nav-right">
          <a href="/clinic/demo" className="btn-nav-ghost">Sign in</a>
          <a href="mailto:hello@dentplus.ca" className="btn-nav-solid">Contact us →</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-badge">
            <div className="badge-dot"></div>
            AI Agent · Online 24 / 7
          </div>
          <h1>
            The dental practice<br />that never <span className="accent">sleeps</span>
          </h1>
          <p className="hero-sub">
            Replace your front desk with an AI agent that books, reschedules, and reminds patients — in French and English — around the clock.
          </p>
          <div className="hero-actions">
            <a href="mailto:hello@dentplus.ca" className="btn-primary">Contact us →</a>
            <a href="https://demo.dentplus.ca" className="btn-ghost" target="_blank" rel="noreferrer">See live demo →</a>
          </div>
          <div className="hero-stats">
            <div>
              <div className="stat-num">24<span>/7</span></div>
              <div className="stat-label">AI availability</div>
            </div>
            <div>
              <div className="stat-num">~<span>$14</span></div>
              <div className="stat-label">AI cost / month</div>
            </div>
            <div>
              <div className="stat-num">FR<span> / EN</span></div>
              <div className="stat-label">Bilingual</div>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="mockup-wrap">
            <div className="mockup-topbar">
              <div className="m-dot" style={{background:'#FF5F57'}}></div>
              <div className="m-dot" style={{background:'#FFBD2E'}}></div>
              <div className="m-dot" style={{background:'#28CA41'}}></div>
              <div className="m-url">demo.dentplus.ca/dashboard</div>
            </div>
            <div className="mockup-body">
              <div className="m-header">Friday, March 27</div>
              <div className="m-stats">
                <div className="m-stat">
                  <div className="m-stat-label">Today</div>
                  <div className="m-stat-val teal">8</div>
                </div>
                <div className="m-stat">
                  <div className="m-stat-label">Confirmed</div>
                  <div className="m-stat-val">6</div>
                </div>
                <div className="m-stat">
                  <div className="m-stat-label">Waitlist</div>
                  <div className="m-stat-val">3</div>
                </div>
              </div>
              <div className="m-appts-label">Appointments</div>
              <div className="m-appt">
                <div className="m-appt-color"></div>
                <div>
                  <div className="m-appt-name">Marie Tremblay</div>
                  <div className="m-appt-meta">10:00 · Cleaning · Dr. Villalta</div>
                </div>
                <div className="m-appt-badge confirmed">✓ Confirmed</div>
              </div>
              <div className="m-appt">
                <div className="m-appt-color orange"></div>
                <div>
                  <div className="m-appt-name">Jean-François L.</div>
                  <div className="m-appt-meta">11:30 · Checkup · Dr. Haim</div>
                </div>
                <div className="m-appt-badge pending">Pending</div>
              </div>
              <div className="m-appt">
                <div className="m-appt-color blue"></div>
                <div>
                  <div className="m-appt-name">Sarah Johnson</div>
                  <div className="m-appt-meta">14:00 · Filling · Dr. Villalta</div>
                </div>
                <div className="m-appt-badge confirmed">✓ Confirmed</div>
              </div>
              <div className="m-ai-strip">
                <div className="ai-chip">AI</div>
                <div className="ai-strip-text">Concierge agent — 3 bookings today</div>
                <div className="ai-dot"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOGOS */}
      <div className="logos-bar">
        <div className="logos-label">Insurance coverage supported</div>
        <div className="logos-items">
          <div className="logo-item">Sun Life</div>
          <div className="logo-item">Manulife</div>
          <div className="logo-item">Desjardins</div>
          <div className="logo-item">Great-West</div>
          <div className="logo-item">Blue Cross</div>
          <div className="logo-item">Telus Health</div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="features" id="features">
        <div className="section-tag">Platform features</div>
        <h2 className="section-title">Everything a clinic needs.<br />Nothing it doesn&apos;t.</h2>
        <p className="section-sub">Built for Canadian dental practices. Bilingual, PIPEDA-compliant, and AI-native from day one.</p>
        <div className="features-grid">
          {[
            { icon: '🤖', title: 'AI Booking Agent', desc: 'Patients book, reschedule, and cancel 24/7 through a conversational AI that understands dental terminology in French and English.' },
            { icon: '📱', title: 'SMS Reminders', desc: 'Bilingual appointment reminders via Twilio. Patients reply YES or NO — confirmations update the schedule in real time, automatically.' },
            { icon: '🔄', title: 'Insurance-Aware Recall', desc: 'Finds patients due for cleanings and contacts them — mentioning their Sun Life or Manulife coverage as a reason to book now.' },
            { icon: '📋', title: 'Digital Intake', desc: '7-section patient intake with e-signature. Medical history, dental history, insurance, and consent — fully digital and PIPEDA-isolated.' },
            { icon: '🗓', title: 'Smart Scheduling', desc: 'Provider schedules, lunch breaks, vacation blocks, and stat holidays. Role-based visibility — dentists see only their own appointments.' },
            { icon: '🏥', title: 'Your Branded Subdomain', desc: 'Every clinic gets yourclinic.dentplus.ca. QR-gated registration, staff approval, and a white-label patient experience out of the box.' },
          ].map(f => (
            <div key={f.title} className="feat-card">
              <div className="feat-icon-wrap">{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <div className="how" id="how">
        <div className="how-inner">
          <div className="section-tag">How it works</div>
          <h2 className="section-title">Live in under an hour.</h2>
          <div className="how-steps">
            {[
              { n: '01', title: 'Sign up your clinic', desc: 'Self-serve onboarding. Enter clinic info, set provider schedules, and get your branded subdomain in minutes.' },
              { n: '02', title: 'Share the QR code', desc: 'Patients scan, register, and complete digital intake from their phone. Staff approves with one click.' },
              { n: '03', title: 'AI handles bookings', desc: 'The AI concierge books appointments, manages the waitlist, and sends bilingual SMS reminders automatically.' },
              { n: '04', title: 'You run the clinic', desc: 'Full dashboard for your team. Dentists, hygienists, and receptionists each see exactly what they need.' },
            ].map(s => (
              <div key={s.n} className="how-step">
                <div className="how-num">{s.n}</div>
                <div className="how-title">{s.title}</div>
                <div className="how-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONTACT / PRICING */}
      <section className="pricing" id="contact">
        <div className="section-tag">Pricing</div>
        <h2 className="section-title">One clinic.<br />One price. Everything included.</h2>
        <p className="section-sub">DentPlus replaces your front desk — AI booking, SMS reminders, recall, scheduling, patient charts, digital intake, and more. Contact us to get started.</p>
        <div className="contact-card">
          <div className="contact-card-top">
            <div className="contact-features">
              <div className="cf-col">
                {['AI booking agent (24/7, FR/EN)', 'SMS reminders + YES/NO replies', 'Insurance-aware recall system', 'Digital patient intake + e-signature'].map(f => (
                  <div key={f} className="cf-item"><span className="cf-check">✓</span> {f}</div>
                ))}
              </div>
              <div className="cf-col">
                {['Full scheduling with block management', 'Treatment planning + invoicing', 'Branded subdomain + patient portal', 'Unlimited providers + staff roles'].map(f => (
                  <div key={f} className="cf-item"><span className="cf-check">✓</span> {f}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="contact-card-bottom">
            <div className="contact-tagline">&ldquo;A front desk that never sleeps — for less than you&apos;d pay a part-time receptionist.&rdquo;</div>
            <a href="mailto:hello@dentplus.ca" className="btn-contact">Contact us for pricing →</a>
            <div className="contact-note">We&apos;ll set up a demo and walk you through everything.</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="cta-wrap">
        <div className="cta-box">
          <div>
            <div className="cta-title">A desk that<br />never sleeps.</div>
            <div className="cta-sub">Everything included. One clinic, one price. Contact us to get started.</div>
          </div>
          <div className="cta-right">
            <a href="mailto:hello@dentplus.ca" className="btn-cta-white">Contact us for pricing →</a>
            <div className="cta-note">We&apos;ll set up a demo and walk you through everything.</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-top">
          <div>
            <div className="footer-brand">
              <div className="footer-brand-icon">🦷</div>
              <div className="footer-brand-text">DentPlus</div>
            </div>
            <div className="footer-tagline">AI-powered dental practice management for Canadian clinics. Bilingual, PIPEDA-compliant, cloud-native.</div>
          </div>
          <div>
            <div className="footer-col-h">Product</div>
            <ul className="footer-links-list">
              <li><a href="#features">Features</a></li>
              <li><a href="#how">How it works</a></li>
              <li><a href="https://demo.dentplus.ca" target="_blank" rel="noreferrer">Demo</a></li>
              <li><a href="#contact">Pricing</a></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-h">Company</div>
            <ul className="footer-links-list">
              <li><a href="mailto:hello@dentplus.ca">Contact</a></li>
              <li><a href="/superadmin">Admin</a></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-h">Legal</div>
            <ul className="footer-links-list">
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Terms</a></li>
              <li><a href="#">PIPEDA</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© 2026 DentPlus Inc. · Made in Canada 🍁</div>
          <div className="footer-copy">dentplus.ca</div>
        </div>
      </footer>
    </>
  )
}
