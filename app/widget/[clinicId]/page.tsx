'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Clinic {
  name: string
  phone: string
  address: string
}

export default function WidgetPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const [clinicId, setClinicId] = useState<string>('')
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    params.then(p => setClinicId(p.clinicId))
  }, [params])

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/clinic/${clinicId}`)
      .then(r => r.json())
      .then(setClinic)
      .catch(() => setClinic({ name: 'Dental Clinic', phone: '', address: '' }))
  }, [clinicId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const startConversation = async () => {
    setStarted(true)
    setLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }], clinicId })
    })
    const data = await res.json()
    setMessages([{ role: 'assistant', content: data.message }])
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, clinicId })
    })
    const data = await res.json()
    setMessages([...newMessages, { role: 'assistant', content: data.message }])
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F0F4F8; }

        .shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          max-width: 480px;
          margin: 0 auto;
          background: white;
          box-shadow: 0 0 40px rgba(0,0,0,0.08);
        }

        .header {
          background: #0F766E;
          padding: 20px 24px;
          color: white;
          flex-shrink: 0;
        }
        .header-top { display: flex; align-items: center; gap: 12px; }
        .avatar {
          width: 42px; height: 42px; border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
        }
        .clinic-name { font-size: 16px; font-weight: 600; letter-spacing: -0.2px; }
        .clinic-sub { font-size: 12px; opacity: 0.75; margin-top: 2px; }
        .status-dot {
          display: inline-block; width: 7px; height: 7px;
          border-radius: 50%; background: #4ADE80;
          margin-right: 5px; vertical-align: middle;
        }

        .messages {
          flex: 1; overflow-y: auto; padding: 24px 16px;
          display: flex; flex-direction: column; gap: 12px;
          min-height: 0;
        }

        .bubble-wrap {
          display: flex; align-items: flex-end; gap: 8px;
        }
        .bubble-wrap.user { flex-direction: row-reverse; }

        .bot-icon {
          width: 28px; height: 28px; border-radius: 50%;
          background: #CCFBF1; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px;
        }

        .bubble {
          max-width: 78%; padding: 11px 15px;
          border-radius: 18px; font-size: 14.5px;
          line-height: 1.55; white-space: pre-wrap;
        }
        .bubble.assistant {
          background: #F1F5F9; color: #1E293B;
          border-bottom-left-radius: 4px;
        }
        .bubble.user {
          background: #0F766E; color: white;
          border-bottom-right-radius: 4px;
        }

        .typing {
          display: flex; align-items: center; gap: 4px;
          padding: 11px 15px; background: #F1F5F9;
          border-radius: 18px; border-bottom-left-radius: 4px;
          width: fit-content;
        }
        .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #94A3B8; animation: bounce 1.2s infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }

        .footer {
          border-top: 1px solid #E2E8F0;
          padding: 12px 16px;
          background: white;
          flex-shrink: 0;
        }
        .input-row {
          display: flex; gap: 8px; align-items: center;
        }
        .input-field {
          flex: 1; padding: 10px 14px;
          border: 1.5px solid #E2E8F0;
          border-radius: 24px; font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          outline: none; color: #1E293B;
          transition: border-color 0.15s;
        }
        .input-field:focus { border-color: #0F766E; }
        .input-field::placeholder { color: #94A3B8; }

        .send-btn {
          width: 40px; height: 40px; border-radius: 50%;
          background: #0F766E; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.15s;
        }
        .send-btn:hover { background: #0D6963; }
        .send-btn:disabled { background: #CBD5E1; cursor: not-allowed; }
        .send-btn svg { width: 18px; height: 18px; fill: white; }

        .start-screen {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 40px 24px; text-align: center;
        }
        .start-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: #F0FDFA; margin-bottom: 20px;
          display: flex; align-items: center; justify-content: center;
          font-size: 36px;
        }
        .start-title {
          font-size: 20px; font-weight: 600; color: #1E293B;
          margin-bottom: 8px;
        }
        .start-sub {
          font-size: 14px; color: #64748B; line-height: 1.6;
          margin-bottom: 28px; max-width: 280px;
        }
        .start-btn {
          background: #0F766E; color: white;
          border: none; border-radius: 24px;
          padding: 13px 28px; font-size: 15px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: background 0.15s;
        }
        .start-btn:hover { background: #0D6963; }

        .chips {
          display: flex; gap: 8px; flex-wrap: wrap;
          padding: 0 16px 12px;
        }
        .chip {
          padding: 6px 14px; border-radius: 20px;
          border: 1.5px solid #0F766E; color: #0F766E;
          font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; background: white;
          transition: all 0.15s;
        }
        .chip:hover { background: #F0FDFA; }
      `}</style>

      <div className="shell">
        <div className="header">
          <div className="header-top">
            <div className="avatar">🦷</div>
            <div>
              <div className="clinic-name">{clinic?.name || 'Loading...'}</div>
              <div className="clinic-sub">
                <span className="status-dot" />
                AI Front Desk — Available 24/7
              </div>
            </div>
          </div>
        </div>

        {!started ? (
          <div className="start-screen">
            <div className="start-icon">🦷</div>
            <div className="start-title">Book your appointment</div>
            <div className="start-sub">
              Our AI assistant will help you book an appointment in under 2 minutes — in English or French.
            </div>
            <button className="start-btn" onClick={startConversation}>
              Start conversation
            </button>
          </div>
        ) : (
          <>
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`bubble-wrap ${msg.role}`}>
                  {msg.role === 'assistant' && <div className="bot-icon">🤖</div>}
                  <div className={`bubble ${msg.role}`}>{msg.content}</div>
                </div>
              ))}
              {loading && (
                <div className="bubble-wrap assistant">
                  <div className="bot-icon">🤖</div>
                  <div className="typing">
                    <div className="dot" />
                    <div className="dot" />
                    <div className="dot" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.length === 1 && !loading && (
              <div className="chips">
                {['Book a cleaning', 'Urgent — I have pain', 'New patient', 'Prendre rendez-vous'].map(chip => (
                  <button key={chip} className="chip" onClick={() => {
                    setInput(chip)
                    setTimeout(() => sendMessage(), 0)
                  }}>
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <div className="footer">
              <div className="input-row">
                <input
                  ref={inputRef}
                  className="input-field"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message..."
                  disabled={loading}
                />
                <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
                  <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
