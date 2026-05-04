import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

function mergeData(priceData, sentimentData) {
  const priceDates = priceData.map(p => p.date).sort()
  const lastPriceDate = priceDates[priceDates.length - 1]

  // For each article, snap to nearest earlier-or-equal price date
  const sentByDate = {}
  sentimentData.forEach(s => {
    const raw = s.published_at || s.created_at
    if (!raw) return
    let date = raw.slice(0, 10)
    if (!priceDates.includes(date)) {
      // Find closest earlier price date
      const earlier = priceDates.filter(d => d <= date)
      date = earlier.length ? earlier[earlier.length - 1] : lastPriceDate
    }
    if (!sentByDate[date]) sentByDate[date] = []
    sentByDate[date].push(s.score)
  })
  const avgSent = Object.fromEntries(
    Object.entries(sentByDate).map(([d, scores]) => [
      d,
      +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
    ])
  )
  return priceData.map(p => ({
    date: p.date,
    close: parseFloat(p.close),
    sentiment: avgSent[p.date] ?? null,
  }))
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400 font-medium">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name === 'close'
            ? `Price: $${entry.value?.toFixed(2)}`
            : `Sentiment: ${entry.value?.toFixed(1)}/10`}
        </p>
      ))}
    </div>
  )
}

// Rendered for every data point on the sentiment line.
// Returns null for points with no sentiment (keeps the line gapped correctly).
function SentimentDot({ cx, cy, payload, selectedDate, onSentimentClick }) {
  if (payload?.sentiment == null) return null
  const isSelected = selectedDate === payload.date
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isSelected ? 7 : 5}
      fill={isSelected ? '#fbbf24' : '#f59e0b'}
      stroke={isSelected ? '#fff' : 'none'}
      strokeWidth={isSelected ? 2 : 0}
      style={{ cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); onSentimentClick(payload.date) }}
    />
  )
}

export default function OverlayChart({ priceData, sentimentData, ticker, selectedDate, onSentimentClick }) {
  const data = mergeData(priceData, sentimentData)

  if (!data.length) {
    return (
      <div className="card flex items-center justify-center h-64 text-slate-600 text-sm">
        No price data for {ticker}
      </div>
    )
  }

  const prices = data.map(d => d.close)
  const priceMin = Math.floor(Math.min(...prices) * 0.995)
  const priceMax = Math.ceil(Math.max(...prices) * 1.005)

  const hasSentiment = data.some(d => d.sentiment != null)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300">
          {ticker} — 30-Day Price &amp; Sentiment Overlay
        </h2>
        {hasSentiment && (
          <p className="text-xs text-slate-600">Click an amber dot to filter news below</p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2f3d' }}
            tickFormatter={d => d.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="price"
            orientation="left"
            domain={[priceMin, priceMax]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v}`}
            width={60}
          />
          <YAxis
            yAxisId="sentiment"
            orientation="right"
            domain={[0, 10]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}/10`}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }}
            formatter={name => name === 'close' ? 'Close Price' : 'Avg Sentiment'}
          />
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#priceGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
          />
          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="sentiment"
            stroke="#f59e0b"
            strokeWidth={2}
            connectNulls={false}
            // Custom dot — clickable, highlights the selected date
            dot={props => (
              <SentimentDot
                key={props.index}
                {...props}
                selectedDate={selectedDate}
                onSentimentClick={onSentimentClick}
              />
            )}
            // Active dot on hover also clickable
            activeDot={props => (
              <circle
                key="active"
                cx={props.cx}
                cy={props.cy}
                r={8}
                fill="#f59e0b"
                stroke="#fff"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onSentimentClick(props.payload.date) }}
              />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
