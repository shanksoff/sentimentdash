import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const map = Object.fromEntries(payload.map(e => [e.dataKey, e]))
  const isForecast = map.yhat != null
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400 font-medium">{label}</p>
      {map.close?.value != null && (
        <p className="text-emerald-400">Price: ${map.close.value.toFixed(2)}</p>
      )}
      {isForecast && map.yhat?.value != null && (
        <>
          <p className="text-violet-400">Forecast: ${map.yhat.value.toFixed(2)}</p>
          {map.ciUpper?.value != null && (
            <p className="text-violet-300/60">
              95% CI: ${(map.yhat.value - (map.yhat.value - map.ciUpper.value)).toFixed(2)} –
              ${map.ciUpper.value.toFixed(2)}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default function ForecastPanel({ forecastData, priceData, ticker }) {
  if (!forecastData?.forecast?.length || !priceData?.length) return null

  const { forecast, model } = forecastData

  // Use last 14 trading days of actual price as context
  const historyWindow = priceData.slice(-14)
  const lastClose = parseFloat(historyWindow[historyWindow.length - 1].close)

  // Build unified chart data: history + anchor + forecast
  const histRows = historyWindow.map(p => ({
    date:     p.date,
    close:    parseFloat(p.close),
    yhat:     null,
    ciBottom: null,
    ciHeight: null,
  }))

  // Anchor point: last actual price seeds the forecast line
  const anchorRow = {
    date:     historyWindow[historyWindow.length - 1].date,
    close:    lastClose,
    yhat:     lastClose,
    ciBottom: lastClose,
    ciHeight: 0,
    ciUpper:  lastClose,
  }

  const forecastRows = forecast.map(f => ({
    date:     f.date,
    close:    null,
    yhat:     f.yhat,
    ciBottom: f.yhat_lower,
    ciHeight: f.yhat_upper - f.yhat_lower,
    ciUpper:  f.yhat_upper,
  }))

  // Replace last history row with anchor (merges actual + forecast seed)
  const chartData = [...histRows.slice(0, -1), anchorRow, ...forecastRows]

  // Y-axis domain covering both history and forecast CI
  const allPrices = [
    ...historyWindow.map(p => parseFloat(p.close)),
    ...forecast.map(f => f.yhat_lower),
    ...forecast.map(f => f.yhat_upper),
  ]
  const yMin = Math.floor(Math.min(...allPrices) * 0.997)
  const yMax = Math.ceil(Math.max(...allPrices)  * 1.003)

  // Vertical line separating history from forecast
  const splitDate = historyWindow[historyWindow.length - 1].date

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-300">
            {ticker} — 7-Day Price Forecast
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Auto-selected model: <span className="font-mono text-slate-500">{model}</span>
            · 95% confidence interval shown
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
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
            domain={[yMin, yMax]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v}`}
            width={60}
          />
          <Tooltip content={<ForecastTooltip />} />

          {/* Vertical line at the history/forecast boundary */}
          <ReferenceLine
            x={splitDate}
            stroke="#475569"
            strokeDasharray="4 3"
            label={{ value: 'Today', position: 'insideTopRight', fill: '#475569', fontSize: 10 }}
          />

          <defs>
            {/* CI band: stacked area trick — transparent base + tinted height */}
            <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#a78bfa" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.06} />
            </linearGradient>
            <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
            </linearGradient>
          </defs>

          {/* Historical price area */}
          <Area
            type="monotone"
            dataKey="close"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#histGrad)"
            dot={false}
            connectNulls={false}
          />

          {/* CI band: transparent base layer */}
          <Area
            type="monotone"
            dataKey="ciBottom"
            stackId="ci"
            stroke="none"
            fill="transparent"
            dot={false}
            connectNulls={false}
            legendType="none"
          />
          {/* CI band: tinted height layer stacked on top of base */}
          <Area
            type="monotone"
            dataKey="ciHeight"
            stackId="ci"
            stroke="none"
            fill="url(#ciGrad)"
            dot={false}
            connectNulls={false}
            legendType="none"
          />

          {/* Forecast point estimate */}
          <Line
            type="monotone"
            dataKey="yhat"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-2 text-[10px] text-slate-600">
        <span className="text-emerald-400/70">— Actual price</span>
        <span className="text-violet-400/70">— Forecast</span>
        <span style={{ color: '#a78bfa44' }}>▮ 95% CI</span>
      </div>
    </div>
  )
}
