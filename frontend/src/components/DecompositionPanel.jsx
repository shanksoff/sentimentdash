import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import InfoTooltip from './InfoTooltip'

const CHART_STYLE = {
  tick:     { fill: '#64748b', fontSize: 10 },
  axisLine: { stroke: '#1E2C3E' },
  grid:     { stroke: '#1E2C3E' },
}

function SubChart({ data, dataKey, color, label, tooltip, height = 100, showXAxis = false, referenceZero = false }) {
  return (
    <div>
      <div className="flex items-center mb-1">
        <p className="text-[10px] text-slate-500 font-mono">{label}</p>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid.stroke} vertical={false} />
          <XAxis
            dataKey="date"
            hide={!showXAxis}
            tick={CHART_STYLE.tick}
            axisLine={CHART_STYLE.axisLine}
            tickLine={false}
            tickFormatter={v => v?.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            width={52}
            tick={CHART_STYLE.tick}
            axisLine={{ stroke: 'transparent' }}
            tickLine={false}
            tickFormatter={v => Number(v).toFixed(1)}
          />
          <Tooltip
            contentStyle={{ background: '#0C1018', border: '1px solid #1E2C3E', borderRadius: 8, fontSize: 10 }}
            labelStyle={{ color: '#64748b' }}
            formatter={(v) => [Number(v).toFixed(2), label]}
          />
          {referenceZero && (
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" strokeOpacity={0.5} />
          )}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.08}
            dot={false}
            activeDot={{ r: 3, fill: color }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DecompositionPanel({ data, ticker }) {
  if (!data || data.error) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-xs">
        {data?.error === 'insufficient_data'
          ? 'Not enough price data for decomposition (need 20+ days).'
          : 'No decomposition data available.'}
      </div>
    )
  }

  // Zip arrays into point objects for Recharts
  const points = data.dates.map((date, i) => ({
    date,
    observed: data.observed[i],
    trend:    data.trend[i],
    seasonal: data.seasonal[i],
    residual: data.residual[i],
  }))

  // Overlay observed + trend on top chart
  const topPoints = points.map(p => ({ ...p }))

  return (
    <div className="flex flex-col gap-4">

      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-300">{ticker} — STL Price Decomposition</h3>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Weekly period (5 trading days) · Robust LOESS smoothing
          </p>
        </div>
        <div className="flex gap-3 text-[10px] text-slate-600 shrink-0">
          <span style={{ color: '#00E5B3' }}>— Trend</span>
          <span style={{ color: '#94a3b8' }}>— Observed</span>
        </div>
      </div>

      {/* Observed + Trend overlay */}
      <div>
        <div className="flex items-center mb-1">
          <p className="text-[10px] text-slate-500 font-mono">Price — Observed vs Trend</p>
          <InfoTooltip text="The grey line is the raw observed closing price. The mint line is the trend component — extracted by LOESS smoothing, which removes weekly cycles and short-term noise. A rising trend line confirms upward momentum independent of day-to-day volatility." />
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={topPoints} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2C3E" vertical={false} />
            <XAxis
              dataKey="date"
              hide
              tick={CHART_STYLE.tick}
              axisLine={CHART_STYLE.axisLine}
              tickLine={false}
            />
            <YAxis
              width={56}
              tick={CHART_STYLE.tick}
              axisLine={{ stroke: 'transparent' }}
              tickLine={false}
              tickFormatter={v => `$${Number(v).toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ background: '#0C1018', border: '1px solid #1E2C3E', borderRadius: 8, fontSize: 10 }}
              labelStyle={{ color: '#64748b' }}
              formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name === 'trend' ? 'Trend' : 'Observed']}
            />
            {/* Observed as faint area */}
            <Area
              type="monotone"
              dataKey="observed"
              stroke="#94a3b8"
              strokeWidth={1}
              fill="#94a3b8"
              fillOpacity={0.05}
              dot={false}
              activeDot={false}
              connectNulls
            />
            {/* Trend as bold mint line */}
            <Line
              type="monotone"
              dataKey="trend"
              stroke="#00E5B3"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: '#00E5B3' }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Seasonal */}
      <SubChart
        data={points}
        dataKey="seasonal"
        color="#a78bfa"
        label="Seasonal Component (weekly cycle)"
        tooltip="The repeating weekly pattern isolated from the price series. A period of 5 trading days is used. Positive values mean that day of the week tends to see prices above the trend; negative means below. For most large-caps this is a small but consistent effect — e.g. Monday weakness or Friday strength."
        height={90}
        referenceZero
      />

      {/* Residual */}
      <SubChart
        data={points}
        dataKey="residual"
        color="#f59e0b"
        label="Residual (noise / unexplained)"
        tooltip="What remains after removing trend and seasonal components. Values close to zero mean the model explains the price well that day. Large spikes — positive or negative — indicate unexpected price moves driven by earnings, macro events, or sudden news flow that neither trend nor seasonality could anticipate."
        height={90}
        showXAxis
        referenceZero
      />

      <p className="text-[10px] text-slate-700">
        Trend = underlying direction · Seasonal = repeating weekly pattern · Residual = what neither explains
      </p>
    </div>
  )
}
