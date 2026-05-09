import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white/[0.03] border border-border rounded-lg px-4 py-3 text-center min-w-[100px]">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color: color ?? '#e2e8f0' }}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400">{d.date}</p>
      <p className="text-amber-400">Sentiment: {d.sentiment}/10</p>
      <p className={d.next_return >= 0 ? 'text-emerald-400' : 'text-red-400'}>
        Next-day return: {d.next_return >= 0 ? '+' : ''}{d.next_return?.toFixed(3)}%
      </p>
    </div>
  )
}

function pValueLabel(p) {
  if (p <= 0.01) return '99% conf.'
  if (p <= 0.05) return '95% conf.'
  if (p <= 0.10) return '90% conf.'
  return 'not sig.'
}

function pValueColor(p) {
  if (p <= 0.01) return '#10b981'
  if (p <= 0.05) return '#34d399'
  if (p <= 0.10) return '#f59e0b'
  return '#64748b'
}

function rColor(r) {
  const abs = Math.abs(r)
  if (abs >= 0.5) return r > 0 ? '#10b981' : '#ef4444'
  if (abs >= 0.3) return r > 0 ? '#34d399' : '#f87171'
  return '#64748b'
}

export default function RegressionPanel({ data }) {
  if (!data) return null
  if (data.error === 'insufficient_data') {
    return (
      <div className="card text-slate-600 text-sm">
        Not enough overlapping sentiment + price data to run regression ({data.n ?? 0} points).
      </div>
    )
  }

  const { r, r_squared, p_value, slope, n, points } = data

  // Trend line: two points spanning the x range
  const xs = points.map(p => p.sentiment)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const trendLine = [
    { sentiment: xMin, trend: slope * xMin + data.intercept },
    { sentiment: xMax, trend: slope * xMax + data.intercept },
  ]

  const direction = slope > 0 ? 'positive' : 'negative'
  const magnitude = Math.abs(r) >= 0.5 ? 'strong' : Math.abs(r) >= 0.3 ? 'moderate' : 'weak'

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-300">
            Sentiment → Next-Day Return (Regression)
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {n} data points · {magnitude} {direction} correlation
          </p>
        </div>

        {/* Stat cards */}
        <div className="flex gap-2 flex-wrap">
          <StatCard
            label="Pearson r"
            value={r >= 0 ? `+${r}` : `${r}`}
            sub="correlation"
            color={rColor(r)}
          />
          <StatCard
            label="R²"
            value={r_squared}
            sub="explained var."
          />
          <StatCard
            label="p-value"
            value={p_value}
            sub={pValueLabel(p_value)}
            color={pValueColor(p_value)}
          />
          <StatCard
            label="Slope"
            value={`${slope >= 0 ? '+' : ''}${slope.toFixed(4)}`}
            sub="% return / pt"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" />
          <XAxis
            type="number"
            dataKey="sentiment"
            name="Sentiment"
            domain={['auto', 'auto']}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2f3d' }}
            label={{ value: 'Sentiment score', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 11 }}
            height={36}
          />
          <YAxis
            type="number"
            dataKey="next_return"
            name="Next-day return"
            domain={['auto', 'auto']}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v.toFixed(1)}%`}
            width={48}
          />
          <Tooltip content={<ScatterTooltip />} />
          <ReferenceLine y={0} stroke="#64748b" strokeOpacity={0.4} />

          {/* Data points */}
          <Scatter data={points} isAnimationActive={false}>
            {points.map((entry, i) => (
              <Cell
                key={`dot-${i}`}
                fill={entry.next_return >= 0 ? '#10b981' : '#ef4444'}
                fillOpacity={0.7}
              />
            ))}
          </Scatter>

          {/* Trend line rendered as a connected scatter */}
          <Scatter
            data={trendLine}
            dataKey="trend"
            line={{ stroke: '#f59e0b', strokeWidth: 2 }}
            shape={() => null}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-slate-600 mt-2 shrink-0">
        Each dot is one trading day: x = avg sentiment score that day, y = log return the following day.
        {p_value <= 0.05
          ? ` The relationship is statistically significant (p = ${p_value}).`
          : ` The relationship is not statistically significant at the 5% level (p = ${p_value}).`}
      </p>
    </div>
  )
}
