import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend,
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400">{label}</p>
      {payload.map(p => p.value != null && (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toFixed(3)}
        </p>
      ))}
    </div>
  )
}

function CorrInterpretation({ points }) {
  if (!points?.length) return null
  // Get latest non-null values
  const latest14 = [...points].reverse().find(p => p.corr_14d != null)?.corr_14d
  const latest30 = [...points].reverse().find(p => p.corr_30d != null)?.corr_30d

  if (latest14 == null && latest30 == null) return null

  const describe = (v) => {
    if (v == null) return '—'
    const abs = Math.abs(v)
    const dir = v > 0 ? 'positive' : 'negative'
    if (abs < 0.1)  return `near-zero (${v.toFixed(2)})`
    if (abs < 0.25) return `weak ${dir} (${v.toFixed(2)})`
    if (abs < 0.5)  return `moderate ${dir} (${v.toFixed(2)})`
    return `strong ${dir} (${v.toFixed(2)})`
  }

  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      <div className="card p-2.5">
        <p className="text-[10px] text-slate-600 mb-0.5">14-day correlation</p>
        <p className="text-xs font-mono" style={{ color: latest14 > 0.1 ? '#00E5B3' : latest14 < -0.1 ? '#ef4444' : '#94a3b8' }}>
          {describe(latest14)}
        </p>
      </div>
      <div className="card p-2.5">
        <p className="text-[10px] text-slate-600 mb-0.5">30-day correlation</p>
        <p className="text-xs font-mono" style={{ color: latest30 > 0.1 ? '#00E5B3' : latest30 < -0.1 ? '#ef4444' : '#94a3b8' }}>
          {describe(latest30)}
        </p>
      </div>
    </div>
  )
}

export default function RollingCorrelationPanel({ data, ticker }) {
  if (!data?.points?.length) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-xs">
        Not enough data to compute rolling correlation.
      </div>
    )
  }

  const { points } = data

  return (
    <div className="flex flex-col gap-4">

      <div>
        <h3 className="text-xs font-semibold text-slate-300">{ticker} — Sentiment vs Return: Rolling Correlation</h3>
        <p className="text-[10px] text-slate-600 mt-0.5">
          Pearson correlation between daily sentiment score and same-day price return
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2C3E" vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={{ stroke: '#1E2C3E' }}
            tickLine={false}
            tickFormatter={v => v?.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            width={40}
            domain={[-1, 1]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={{ stroke: 'transparent' }}
            tickLine={false}
            tickFormatter={v => v.toFixed(1)}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Noise band: -0.2 to +0.2 — correlation here is not meaningful */}
          <ReferenceArea y1={-0.2} y2={0.2} fill="#64748b" fillOpacity={0.06} />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" strokeOpacity={0.5} />
          {/* +/- 0.2 threshold lines */}
          <ReferenceLine y={0.2}  stroke="#64748b" strokeDasharray="2 4" strokeOpacity={0.3} />
          <ReferenceLine y={-0.2} stroke="#64748b" strokeDasharray="2 4" strokeOpacity={0.3} />

          <Line
            type="monotone"
            dataKey="corr_14d"
            name="14-day"
            stroke="#00E5B3"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: '#00E5B3' }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="corr_30d"
            name="30-day"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 3, fill: '#a78bfa' }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex gap-4 text-[10px] text-slate-600">
        <span style={{ color: '#00E5B380' }}>— 14-day window</span>
        <span style={{ color: '#a78bfa80' }}>— 30-day window</span>
        <span className="text-slate-700">▮ noise band (|r| &lt; 0.2)</span>
      </div>

      <CorrInterpretation points={points} />

      <p className="text-[10px] text-slate-700">
        Positive correlation = higher sentiment days tend to coincide with positive returns.
        Values inside the grey band are statistically weak. Correlation ≠ causation.
      </p>
    </div>
  )
}
