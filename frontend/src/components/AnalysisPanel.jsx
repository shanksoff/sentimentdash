import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Tone / confidence config ─────────────────────────────────

const TONE_CONFIG = {
  Bullish: { color: '#10b981', bg: '#10b98118', border: '#10b98140', icon: '↑' },
  Neutral: { color: '#94a3b8', bg: '#94a3b818', border: '#94a3b840', icon: '→' },
  Bearish: { color: '#ef4444', bg: '#ef444418', border: '#ef444440', icon: '↓' },
}
const CONF_COLOR = { High: '#10b981', Medium: '#f59e0b', Low: '#94a3b8' }

// ─── Predefined questions ─────────────────────────────────────

const QUESTIONS = [
  "What's the bull case?",
  "What are the main risks?",
  "Is now a good entry point?",
  "How does sentiment compare to price?",
  "What could cause a big move?",
]

// ─── Chat bubble ──────────────────────────────────────────────

function Bubble({ role, text, streaming }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
          isUser
            ? 'bg-emerald-600/20 text-emerald-200 rounded-br-sm'
            : 'bg-white/[0.05] text-slate-300 rounded-bl-sm'
        }`}
      >
        {text}
        {streaming && (
          <span className="inline-block w-1.5 h-3 ml-0.5 bg-slate-400 align-middle animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

export default function AnalysisPanel({ data, loading, ticker }) {
  const [chat, setChat]       = useState([])
  const [asking, setAsking]   = useState(false)
  const bottomRef             = useRef(null)

  // Reset chat when ticker changes
  useEffect(() => { setChat([]) }, [ticker])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const askQuestion = useCallback(async (question) => {
    if (asking || !ticker) return
    setAsking(true)

    setChat(prev => [
      ...prev,
      { role: 'user',      text: question, streaming: false },
      { role: 'assistant', text: '',       streaming: true  },
    ])

    try {
      const res = await fetch(`/api/chat/${ticker}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question }),
      })

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const payload = part.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const { text } = JSON.parse(payload)
            setChat(prev => prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, text: m.text + text } : m
            ))
          } catch { /* malformed chunk — skip */ }
        }
      }
    } catch {
      setChat(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, text: 'Error generating response.', streaming: false }
          : m
      ))
    } finally {
      setChat(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, streaming: false } : m
      ))
      setAsking(false)
    }
  }, [asking, ticker])

  // ── Render ───────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="card flex items-center gap-3 text-slate-500 text-sm">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
        Generating AI analysis…
      </div>
    )
  }

  if (!data) return null

  const tone      = TONE_CONFIG[data.tone]      ?? TONE_CONFIG.Neutral
  const confColor = CONF_COLOR[data.confidence] ?? CONF_COLOR.Low
  let generatedAt = ''
  try {
    generatedAt = new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { /* ignore */ }

  return (
    <div className="card flex flex-col gap-3">

      {/* ── Briefing header ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <h2 className="text-sm font-semibold text-slate-300">AI Analyst Briefing</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: confColor }}>{data.confidence}</span>
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold"
            style={{ background: tone.bg, borderColor: tone.border, color: tone.color }}
          >
            <span>{tone.icon}</span>
            <span>{data.tone}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">{data.briefing}</p>

      {data.key_risk && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-950/20 border border-amber-800/40">
          <span className="text-amber-400 text-xs mt-0.5 shrink-0">⚠</span>
          <p className="text-xs text-amber-300/80 leading-relaxed">{data.key_risk}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-700">AI-generated — not financial advice.</p>
        {generatedAt && <p className="text-[10px] text-slate-700">Gemini · {generatedAt}</p>}
      </div>

      {/* ── Divider ──────────────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Predefined questions ─────────────────────────────── */}
      <div>
        <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-2">Ask a question</p>
        <div className="flex flex-wrap gap-1.5">
          {QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => askQuestion(q)}
              disabled={asking}
              className={`px-2.5 py-1 text-[10px] rounded-full border transition-colors ${
                asking
                  ? 'text-slate-700 border-slate-800 cursor-not-allowed'
                  : 'text-slate-400 border-slate-700 hover:text-emerald-300 hover:border-emerald-700/60 hover:bg-emerald-900/10'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat thread ──────────────────────────────────────── */}
      {chat.length > 0 && (
        <div className="flex flex-col gap-2">
          {chat.map((msg, i) => (
            <Bubble key={i} role={msg.role} text={msg.text} streaming={msg.streaming} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

    </div>
  )
}
