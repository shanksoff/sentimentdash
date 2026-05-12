import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ─── Rolling average helper ──────────────────────────────────

function rollingAvg(arr, window) {
  return arr.map((v, i) => {
    if (v == null) return null
    const slice = arr.slice(Math.max(0, i - window + 1), i + 1).filter(x => x != null)
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null
  })
}

// ─── Build aligned dataset ───────────────────────────────────

function buildChartData(priceData, sentimentData) {
  // Daily avg sentiment
  const sentByDate = {}
  for (const row of sentimentData) {
    const d = String(row.published_at ?? row.created_at ?? '').slice(0, 10)
    if (!d) continue
    if (!sentByDate[d]) sentByDate[d] = []
    sentByDate[d].push(Number(row.score))
  }
  const dailySent = {}
  for (const [d, scores] of Object.entries(sentByDate)) {
    dailySent[d] = scores.reduce((a, b) => a + b, 0) / scores.length
  }

  const sorted = [...priceData].sort((a, b) => String(a.date).localeCompare(String(b.date)))

  // Build raw rows with price + raw sentiment
  const raw = sorted.map(r => ({
    date:  String(r.date).slice(0, 10),
    close: parseFloat(r.close),
    sent:  dailySent[String(r.date).slice(0, 10)] ?? null,
  }))

  // 7-day rolling avg sentiment
  const sentVals = raw.map(r => r.sent)
  const smoothed = rollingAvg(sentVals, 7)

  return raw.map((r, i) => ({
    ...r,
    sentSmooth: smoothed[i] != null ? parseFloat(smoothed[i].toFixed(2)) : null,
  }))
}

// ─── Custom tooltip ──────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const price = payload.find(p => p.dataKey === 'close')
  const sent  = payload.find(p => p.dataKey === 'sentSmooth')
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400">{label}</p>
      {price && <p style={{ color: '#00E5B3' }}>Price: ${Number(price.value).toFixed(2)}</p>}
      {sent  && <p style={{ color: '#f59e0b' }}>Sentiment (7d avg): {Number(sent.value).toFixed(1)}/10</p>}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────

export default function SentimentPriceChart({ priceData, sentimentData, ticker }) {
  if (!priceData?.length || !sentimentData?.length) return null

  const data = buildChartData(priceData, sentimentData)

  // Only keep last 30 data points for readability
  const visible = data.slice(-30)

  // Y-axis domains
  const closes   = visible.map(d => d.close).filter(Boolean)
  const priceMin = Math.min(...closes) * 0.995
  const priceMax = Math.max(...closes) * 1.005

  // Tick formatter — show short date
  const fmtDate = d => {
    const [, m, day] = d.split('-')
    return `${m}/${day}`
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="shrink-0">
        <h2 className="text-sm font-semibold text-slate-300 mb-1">
          {ticker} — Price vs Sentiment (30-day)
        </h2>
        <p className="text-xs text-slate-600 mb-4">
          7-day rolling average sentiment overlaid on close price
        </p>
      </div>

      <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={visible} margin={{ top: 4, right: 50, left: 0, bottom: 0 }} syncId="chartSync">
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2533" />

          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          {/* Left axis — price */}
          <YAxis
            yAxisId="price"
            orientation="left"
            domain={[priceMin, priceMax]}
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={v => `$${v.toFixed(0)}`}
          />

          {/* Right axis — sentiment 1–10 */}
          <YAxis
            yAxisId="sent"
            orientation="right"
            domain={[1, 10]}
            ticks={[1, 3, 5, 7, 10]}
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={v => `${v}`}
          />

          <Tooltip content={<ChartTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }}
            formatter={name => name === 'close' ? 'Close Price' : '7d Avg Sentiment'}
          />

          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#00E5B3"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />

          <Line
            yAxisId="sent"
            type="monotone"
            dataKey="sentSmooth"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-slate-700 mt-2 shrink-0">
        Sentiment axis: 1 (very negative) → 10 (very positive). Gaps = no news scored that day.
      </p>
    </div>
  )
}
