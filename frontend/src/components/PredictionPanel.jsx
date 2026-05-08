import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ─── Signal config ───────────────────────────────────────────

const SIGNAL_CONFIG = {
  Watch: {
    color:   '#10b981',
    bg:      '#10b98118',
    border:  '#10b98140',
    label:   'Watch',
    desc:    'Model leans bullish — worth monitoring for entry.',
  },
  Hold: {
    color:   '#f59e0b',
    bg:      '#f59e0b18',
    border:  '#f59e0b40',
    label:   'Hold',
    desc:    'No clear directional edge — stay current position.',
  },
  Avoid: {
    color:   '#ef4444',
    bg:      '#ef444418',
    border:  '#ef444440',
    label:   'Avoid',
    desc:    'Model leans bearish — exercise caution.',
  },
}

// ─── Probability bar ─────────────────────────────────────────

function ProbBar({ prob, color }) {
  const pct = Math.round(prob * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>P(price up in 5 days)</span>
        <span className="font-mono font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-700">
        <span>0% Bearish</span>
        <span>50% Neutral</span>
        <span>100% Bullish</span>
      </div>
    </div>
  )
}

// ─── Feature importance tooltip ──────────────────────────────

function ImportanceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400">{label}</p>
      <p className="text-emerald-400">Importance: {(payload[0].value * 100).toFixed(1)}%</p>
    </div>
  )
}

// ─── Target price block ──────────────────────────────────────

function TargetPrice({ forecastData, priceData, horizonDays, color }) {
  if (!forecastData?.forecast?.length || !priceData?.length) return null

  const lastClose = parseFloat(priceData[priceData.length - 1]?.close)
  if (!lastClose) return null

  // Pick the forecast point closest to horizonDays trading days out
  const idx = Math.min(horizonDays - 1, forecastData.forecast.length - 1)
  const pt = forecastData.forecast[idx]
  if (!pt) return null

  const chg = ((pt.yhat - lastClose) / lastClose) * 100
  const arrow = chg >= 0 ? '↑' : '↓'

  return (
    <div className="mb-6 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
        {horizonDays}-Day Price Target <span className="normal-case">(ARIMA estimate)</span>
      </p>
      <div className="flex items-end gap-3 flex-wrap">
        <span className="text-2xl font-mono font-bold" style={{ color }}>
          ${pt.yhat.toFixed(2)}
        </span>
        <span className="text-sm font-mono mb-0.5" style={{ color }}>
          {arrow} {Math.abs(chg).toFixed(2)}%
        </span>
        <span className="text-xs text-slate-600 mb-0.5">
          95% CI: ${pt.yhat_lower.toFixed(2)} – ${pt.yhat_upper.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────

export default function PredictionPanel({ data, ticker, forecastData, priceData }) {
  if (!data) return null
  if (data.error === 'insufficient_data') {
    return (
      <div className="card text-slate-600 text-sm">
        Not enough data to run prediction model ({data.n_samples ?? 0} samples — need at least 10).
      </div>
    )
  }

  const { signal, prob_up, n_samples, cv_accuracy, feature_importance, horizon_days } = data
  const cfg = SIGNAL_CONFIG[signal] ?? SIGNAL_CONFIG.Hold
  const accuracyLabel = cv_accuracy != null
    ? `${(cv_accuracy * 100).toFixed(0)}% CV accuracy`
    : 'CV accuracy unavailable'

  return (
    <div className="card">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-300">
            {ticker} — {horizon_days}-Day Price Direction Prediction
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Random Forest · {n_samples} training samples · {accuracyLabel}
          </p>
        </div>

        {/* Signal badge */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
          style={{ background: cfg.bg, borderColor: cfg.border }}
        >
          <span className="text-2xl font-bold font-mono" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="text-xs text-slate-500 max-w-[160px] leading-snug">{cfg.desc}</span>
        </div>
      </div>

      {/* ── Target price ────────────────────────────────────── */}
      <TargetPrice
        forecastData={forecastData}
        priceData={priceData}
        horizonDays={horizon_days}
        color={cfg.color}
      />

      {/* ── Probability bar ─────────────────────────────────── */}
      <div className="mb-6">
        <ProbBar prob={prob_up} color={cfg.color} />
      </div>

      {/* ── Feature importance chart ────────────────────────── */}
      <div>
        <p className="text-xs text-slate-500 mb-3">Feature importance (what drove this prediction)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={feature_importance}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <Tooltip content={<ImportanceTooltip />} />
            <Bar dataKey="importance" radius={[0, 3, 3, 0]} barSize={12}>
              {feature_importance.map((entry, i) => (
                <Cell
                  key={`fi-${i}`}
                  fill={i === 0 ? cfg.color : '#334155'}
                  fillOpacity={i === 0 ? 0.9 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Disclaimer ─────────────────────────────────────── */}
      <p className="text-[10px] text-slate-700 mt-3 leading-relaxed">
        Not financial advice. Model trained on ~{n_samples} in-sample observations —
        use as one signal among many, not as a standalone trading decision.
      </p>
    </div>
  )
}
