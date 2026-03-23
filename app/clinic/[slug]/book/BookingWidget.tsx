'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ClinicInfo } from '@/lib/clinic'

interface Message { role: 'user' | 'assistant'; content: string }

export default function BookingWidget({ clinic }: { clinic: ClinicInfo }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [patientAuthId, setPatientAuthId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const color = clinic.primary_color || '#0EA5E9'
  const supabase = createClient()

  // Detect if a patient is already logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setPatientAuthId(user.id)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendToApi = async (msgs: Message[]) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: msgs,
        clinicId: clinic.id,
        patientAuthId  // null if not logged in — agent will ask for name as normal
      })
    })
    return res.json()
  }

  const startConversation = async () => {
    setStarted(true)
    setLoading(true)
    const data = await sendToApi([{ role: 'user', content: 'Hello' }])
    setMessages([{ role: 'assistant', content: data.message }])
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim()
    if (!text || loading) return
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    const data = await sendToApi(newMessages)
    setMessages([...newMessages, { role: 'assistant', content: data.message }])
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F8FAFC; }
        .shell { min-height: 100vh; display: flex; flex-direction: column; max-width: 480px; margin: 0 auto; background: white; box-shadow: 0 0 40px rgba(0,0,0,0.08); }
        .header { padding: 18px 20px; color: white; flex-shrink: 0; display: flex; align-items: center; gap: 12px; }
        .avatar { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .clinic-name { font-size: 15px; font-weight: 600; }
        .clinic-status { font-size: 11px; opacity: 0.75; margin-top: 1px; display: flex; align-items: center; gap: 4px; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ADE80; }
        .messages { flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
        .bubble-wrap { display: flex; align-items: flex-end; gap: 8px; }
        .bubble-wrap.user { flex-direction: row-reverse; }
        .bot-icon { width: 26px; height: 26px; border-radius: 50%; background: #E0F2FE; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; }
        .bubble { max-width: 78%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.55; white-space: pre-wrap; }
        .bubble.assistant { background: #F1F5F9; color: #1E293B; border-bottom-left-radius: 4px; }
        .bubble.user { color: white; border-bottom-right-radius: 4px; }
        .typing { display: flex; align-items: center; gap: 4px; padding: 10px 14px; background: #F1F5F9; border-radius: 16px; border-bottom-left-radius: 4px; width: fit-content; }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: #94A3B8; animation: bounce 1.2s infinite; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
        .footer { border-top: 1px solid #E2E8F0; padding: 12px 16px; background: white; flex-shrink: 0; }
        .input-row { display: flex; gap: 8px; align-items: center; }
        .input-field { flex: 1; padding: 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 22px; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; color: #1E293B; transition: border-color 0.15s; }
        .input-field:focus { border-color: var(--clinic-color, #0EA5E9); }
        .send-btn { width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: filter 0.15s; }
        .send-btn:hover { filter: brightness(0.9); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .start-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; }
        .start-icon { width: 68px; height: 68px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 34px; margin-bottom: 18px; }
        .start-title { font-size: 20px; font-weight: 600; color: #1E293B; margin-bottom: 8px; }
        .start-sub { font-size: 14px; color: #64748B; line-height: 1.6; margin-bottom: 28px; max-width: 280px; }
        .start-btn { color: white; border: none; border-radius: 22px; padding: 12px 28px; font-size: 15px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: filter 0.15s; }
        .start-btn:hover { filter: brightness(0.92); }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 16px 12px; }
        .chip { padding: 6px 14px; border-radius: 20px; border: 1.5px solid; font-size: 12px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; background: white; transition: all 0.15s; }
      `}</style>

      <div className="shell">
        <div className="header" style={{ background: color }}>
          <div className="avatar">🦷</div>
          <div>
            <div className="clinic-name">{clinic.name}</div>
            <div className="clinic-status">
              <div className="status-dot" />
              AI Front Desk — Available 24/7
            </div>
          </div>
        </div>

        {!started ? (
          <div className="start-screen">
            <div className="start-icon" style={{ background: `${color}18` }}>🦷</div>
            <div className="start-title">Book your appointment</div>
            <div className="start-sub">
              Our AI assistant will help you book in under 2 minutes — in English or French.
            </div>
            <button className="start-btn" style={{ background: color }} onClick={startConversation}>
              Start conversation
            </button>
          </div>
        ) : (
          <>
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`bubble-wrap ${msg.role}`}>
                  {msg.role === 'assistant' && <div className="bot-icon">🤖</div>}
                  <div
                    className={`bubble ${msg.role}`}
                    style={msg.role === 'user' ? { background: color } : {}}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="bubble-wrap assistant">
                  <div className="bot-icon">🤖</div>
                  <div className="typing">
                    <div className="dot" /><div className="dot" /><div className="dot" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.length === 1 && !loading && (
              <div className="chips">
                {['Book a cleaning', 'I have tooth pain', 'New patient', 'Prendre rendez-vous'].map(chip => (
                  <button
                    key={chip}
                    className="chip"
                    style={{ borderColor: color, color }}
                    onClick={() => sendMessage(chip)}
                  >
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
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Type a message..."
                  disabled={loading}
                />
                <button
                  className="send-btn"
                  style={{ background: color }}
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
