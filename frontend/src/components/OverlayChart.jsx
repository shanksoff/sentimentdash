import { useState } from 'react'
import {
  ComposedChart, Area, Line, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { bollingerBands, rsi as calcRSI, macd as calcMACD } from '../utils/indicators'

// ─── Data helpers ────────────────────────────────────────────

function mergeData(priceData, sentimentData) {
  const priceDates = priceData.map(p => p.date).sort()
  const lastPriceDate = priceDates[priceDates.length - 1]

  const sentByDate = {}
  sentimentData.forEach(s => {
    const raw = s.published_at || s.created_at
    if (!raw) return
    let date = raw.slice(0, 10)
    if (!priceDates.includes(date)) {
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
    date:      p.date,
    close:     parseFloat(p.close),
    sentiment: avgSent[p.date] ?? null,
  }))
}

// Shared x-axis props — all charts use the same so syncId aligns correctly
const xAxisProps = {
  dataKey:       'date',
  tick:          { fill: '#64748b', fontSize: 11 },
  tickLine:      false,
  axisLine:      { stroke: '#2a2f3d' },
  tickFormatter: d => d.slice(5),
  interval:      'preserveStartEnd',
}

// All sub-charts must match the main chart's left YAxis width (60) and
// right YAxis width (50) so the plot areas are pixel-aligned when syncId syncs.
const LEFT_W  = 60
const RIGHT_W = 50

// ─── Tooltips ────────────────────────────────────────────────

function PriceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const map = Object.fromEntries(payload.map(e => [e.dataKey, e]))
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400 font-medium">{label}</p>
      {map.close     && <p className="text-emerald-400">Price: ${map.close.value?.toFixed(2)}</p>}
      {map.sentiment && <p className="text-amber-400">Sentiment: {map.sentiment.value?.toFixed(1)}/10</p>}
      {map.bbUpper   && <p className="text-sky-400">BB Upper: ${map.bbUpper.value?.toFixed(2)}</p>}
      {map.bbMid     && <p className="text-sky-300">BB Mid: ${map.bbMid.value?.toFixed(2)}</p>}
      {map.bbLower   && <p className="text-sky-400">BB Lower: ${map.bbLower.value?.toFixed(2)}</p>}
    </div>
  )
}

function RSITooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload.find(e => e.dataKey === 'rsi')?.value
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400 font-medium">{label}</p>
      {val != null && <p className="text-violet-400">RSI: {val.toFixed(1)}</p>}
    </div>
  )
}

function MACDTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const map = Object.fromEntries(payload.map(e => [e.dataKey, e]))
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400 font-medium">{label}</p>
      {map.macd?.value   != null && <p className="text-blue-400">MACD: {map.macd.value.toFixed(4)}</p>}
      {map.signal?.value != null && <p className="text-orange-400">Signal: {map.signal.value.toFixed(4)}</p>}
      {(map.histogram?.value ?? null) != null &&
        <p className={map.histogram.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          Hist: {map.histogram.value.toFixed(4)}
        </p>}
    </div>
  )
}

// ─── Sentiment dot (clickable) ───────────────────────────────

function SentimentDot({ cx, cy, payload, selectedDate, onSentimentClick }) {
  if (payload?.sentiment == null) return null
  const isSelected = selectedDate === payload.date
  return (
    <circle
      cx={cx} cy={cy}
      r={isSelected ? 7 : 5}
      fill={isSelected ? '#fbbf24' : '#f59e0b'}
      stroke={isSelected ? '#fff' : 'none'}
      strokeWidth={isSelected ? 2 : 0}
      style={{ cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); onSentimentClick(payload.date) }}
    />
  )
}

// ─── Indicator toggle button ─────────────────────────────────

function IndicatorBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors border ${
        active
          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/50'
          : 'bg-transparent text-slate-500 border-border hover:text-slate-300 hover:border-slate-500'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Main component ──────────────────────────────────────────

export default function OverlayChart({
  priceData, sentimentData, ticker, selectedDate, onSentimentClick,
}) {
  // All indicators on by default — user can toggle off
  const [ind, setInd] = useState({ bb: true, rsi: true, macd: true })
  const toggle = key => setInd(prev => ({ ...prev, [key]: !prev[key] }))

  const base = mergeData(priceData, sentimentData)

  if (!base.length) {
    return (
      <div className="card flex items-center justify-center h-64 text-slate-600 text-sm">
        No price data for {ticker}
      </div>
    )
  }

  // ── Compute indicators ──────────────────────────────────────
  const closes = priceData.map(p => parseFloat(p.close))
  const bb      = bollingerBands(closes)
  const rsiVals = calcRSI(closes)
  const { macdLine, signalLine, histogram } = calcMACD(closes)

  // ── Slice to last 30 trading days for display (indicators computed on full data) ──
  const DISPLAY_DAYS = 30
  const sliceStart = Math.max(0, priceData.length - DISPLAY_DAYS)

  const priceChartData = base.slice(sliceStart).map((d, j) => ({
    ...d,
    bbUpper: bb[sliceStart + j].upper,
    bbMid:   bb[sliceStart + j].mid,
    bbLower: bb[sliceStart + j].lower,
  }))

  const rsiChartData = priceData.slice(sliceStart).map((p, j) => ({
    date: p.date,
    rsi:  rsiVals[sliceStart + j],
  }))

  const macdChartData = priceData.slice(sliceStart).map((p, j) => ({
    date:      p.date,
    macd:      macdLine[sliceStart + j],
    signal:    signalLine[sliceStart + j],
    histogram: histogram[sliceStart + j],
  }))

  // ── Price chart domain (over displayed window only) ─────────
  const displayCloses = closes.slice(sliceStart)
  const priceMin = Math.floor(Math.min(...displayCloses) * 0.995)
  const priceMax = Math.ceil(Math.max(...displayCloses) * 1.005)

  const hasSentiment = base.slice(sliceStart).some(d => d.sentiment != null)
  const days = priceChartData.length

  return (
    <div className="card space-y-0">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-300">
          {ticker} — {days}-Day Price &amp; Sentiment Overlay
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <IndicatorBtn label="BB"   active={ind.bb}   onClick={() => toggle('bb')}   />
            <IndicatorBtn label="RSI"  active={ind.rsi}  onClick={() => toggle('rsi')}  />
            <IndicatorBtn label="MACD" active={ind.macd} onClick={() => toggle('macd')} />
          </div>
          {hasSentiment && (
            <p className="text-xs text-slate-600">Click an amber dot to filter news below</p>
          )}
        </div>
      </div>

      {/* ── Price + Sentiment (+ optional BB) ──────────────── */}
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
          data={priceChartData}
          syncId="chartSync"
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" vertical={false} />
          <XAxis {...xAxisProps} />
          <YAxis
            yAxisId="price"
            orientation="left"
            domain={[priceMin, priceMax]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v}`}
            width={LEFT_W}
          />
          <YAxis
            yAxisId="sentiment"
            orientation="right"
            domain={[0, 10]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}/10`}
            width={RIGHT_W}
          />
          <Tooltip content={<PriceTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }}
            formatter={name => ({
              close:     'Close Price',
              sentiment: 'Avg Sentiment',
              bbUpper:   'BB Upper',
              bbMid:     'BB Mid',
              bbLower:   'BB Lower',
            }[name] ?? name)}
          />
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
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

          {ind.bb && <>
            <Line yAxisId="price" type="monotone" dataKey="bbUpper" stroke="#38bdf8"
                  strokeWidth={1} strokeDasharray="4 3" dot={false} activeDot={false} />
            <Line yAxisId="price" type="monotone" dataKey="bbMid"   stroke="#7dd3fc"
                  strokeWidth={1} strokeDasharray="2 3" dot={false} activeDot={false} />
            <Line yAxisId="price" type="monotone" dataKey="bbLower" stroke="#38bdf8"
                  strokeWidth={1} strokeDasharray="4 3" dot={false} activeDot={false} />
          </>}

          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="sentiment"
            stroke="#f59e0b"
            strokeWidth={2}
            connectNulls={false}
            dot={props => (
              <SentimentDot
                key={props.index}
                {...props}
                selectedDate={selectedDate}
                onSentimentClick={onSentimentClick}
              />
            )}
            activeDot={props => (
              <circle
                key="active"
                cx={props.cx} cy={props.cy} r={8}
                fill="#f59e0b" stroke="#fff" strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onSentimentClick(props.payload.date) }}
              />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── RSI sub-chart ───────────────────────────────────── */}
      {ind.rsi && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-slate-500 mb-2 font-mono">RSI (14)</p>
          <ResponsiveContainer width="100%" height={90}>
            <ComposedChart
              data={rsiChartData}
              syncId="chartSync"
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" vertical={false} />
              <XAxis {...xAxisProps} />
              {/* Match LEFT_W exactly so plot area aligns with price chart */}
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                ticks={[0, 30, 50, 70, 100]}
                width={LEFT_W}
              />
              {/* Hidden right axis reserves the same space as the price chart's right axis */}
              <YAxis yAxisId="r" orientation="right" width={RIGHT_W} hide />
              <Tooltip content={<RSITooltip />} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={50} stroke="#64748b" strokeDasharray="2 4" strokeOpacity={0.4} />
              <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={2}
                    dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1 text-[10px] text-slate-600">
            <span className="text-red-400/70">— 70 overbought</span>
            <span className="text-emerald-400/70">— 30 oversold</span>
          </div>
        </div>
      )}

      {/* ── MACD sub-chart ──────────────────────────────────── */}
      {ind.macd && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-slate-500 mb-2 font-mono">MACD (12, 26, 9)</p>
          <ResponsiveContainer width="100%" height={90}>
            <ComposedChart
              data={macdChartData}
              syncId="chartSync"
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={LEFT_W}
                tickFormatter={v => v.toFixed(1)}
              />
              <YAxis yAxisId="r" orientation="right" width={RIGHT_W} hide />
              <Tooltip content={<MACDTooltip />} />
              <ReferenceLine y={0} stroke="#64748b" strokeOpacity={0.4} />
              <Bar dataKey="histogram" barSize={4}>
                {macdChartData.map((entry, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={entry.histogram == null
                      ? 'transparent'
                      : entry.histogram >= 0 ? '#10b981' : '#ef4444'}
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
              <Line type="monotone" dataKey="macd"   stroke="#60a5fa" strokeWidth={1.5}
                    dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="signal" stroke="#fb923c" strokeWidth={1.5}
                    dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1 text-[10px] text-slate-600">
            <span className="text-blue-400/70">— MACD</span>
            <span className="text-orange-400/70">— Signal</span>
            <span className="text-emerald-400/70">▮ Histogram +</span>
            <span className="text-red-400/70">▮ Histogram −</span>
          </div>
        </div>
      )}
    </div>
  )
}
