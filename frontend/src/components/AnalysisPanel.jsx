// ─── Tone config ─────────────────────────────────────────────

const TONE_CONFIG = {
  Bullish: {
    color:   '#10b981',
    bg:      '#10b98118',
    border:  '#10b98140',
    icon:    '↑',
  },
  Neutral: {
    color:   '#94a3b8',
    bg:      '#94a3b818',
    border:  '#94a3b840',
    icon:    '→',
  },
  Bearish: {
    color:   '#ef4444',
    bg:      '#ef444418',
    border:  '#ef444440',
    icon:    '↓',
  },
}

const CONF_COLOR = {
  High:   '#10b981',
  Medium: '#f59e0b',
  Low:    '#94a3b8',
}

// ─── Main component ──────────────────────────────────────────

export default function AnalysisPanel({ data, loading }) {
  if (loading) {
    return (
      <div className="card flex items-center gap-3 text-slate-500 text-sm">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
        Generating AI analysis…
      </div>
    )
  }

  if (!data) return null

  const tone = TONE_CONFIG[data.tone] ?? TONE_CONFIG.Neutral
  const confColor = CONF_COLOR[data.confidence] ?? CONF_COLOR.Low

  // Format generated_at timestamp
  let generatedAt = ''
  if (data.generated_at) {
    try {
      generatedAt = new Date(data.generated_at).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit',
      })
    } catch { /* ignore */ }
  }

  return (
    <div className="card">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <h2 className="text-sm font-semibold text-slate-300">AI Analyst Briefing</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Confidence badge */}
          <span className="text-xs font-mono" style={{ color: confColor }}>
            {data.confidence} confidence
          </span>

          {/* Tone badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold"
            style={{ background: tone.bg, borderColor: tone.border, color: tone.color }}
          >
            <span>{tone.icon}</span>
            <span>{data.tone}</span>
          </div>
        </div>
      </div>

      {/* ── Briefing ────────────────────────────────────────── */}
      <p className="text-sm text-slate-300 leading-relaxed mb-4">
        {data.briefing}
      </p>

      {/* ── Key risk ────────────────────────────────────────── */}
      {data.key_risk && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40">
          <span className="text-amber-400 text-xs mt-0.5 shrink-0">⚠</span>
          <p className="text-xs text-amber-300/80 leading-relaxed">{data.key_risk}</p>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-slate-700">
          Not financial advice. AI-generated — verify independently before acting.
        </p>
        <p className="text-[10px] text-slate-700 whitespace-nowrap shrink-0">
          Powered by Gemini{generatedAt ? ` · ${generatedAt}` : ''}
        </p>
      </div>
    </div>
  )
}
