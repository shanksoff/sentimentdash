import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { rollingVolatility } from '../utils/indicators'

function volColor(vol) {
  if (vol == null) return '#64748b'
  if (vol < 20)   return '#10b981' // low  — green
  if (vol < 40)   return '#f59e0b' // mid  — amber
  return '#ef4444'                  // high — red
}

function volLabel(vol) {
  if (vol == null) return '—'
  if (vol < 20)   return 'Low'
  if (vol < 40)   return 'Moderate'
  return 'High'
}

function VolTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="card text-xs space-y-1 shadow-xl">
      <p className="text-slate-400 font-medium">{label}</p>
      {val != null && (
        <p style={{ color: volColor(val) }}>
          Volatility: {val.toFixed(1)}% ({volLabel(val)})
        </p>
      )}
    </div>
  )
}

export default function VolatilityPanel({ priceData }) {
  if (!priceData?.length) return null

  const closes = priceData.map(p => parseFloat(p.close))
  const volSeries = rollingVolatility(closes)

  const chartData = priceData.map((p, i) => ({
    date: p.date,
    vol:  volSeries[i],
  }))

  // Current volatility = last non-null value
  const currentVol = [...volSeries].reverse().find(v => v != null)
  const color = volColor(currentVol)

  // For gradient, use current colour
  const gradId = 'volGrad'

  // y-axis max: round up to next 10
  const maxVol = Math.max(...volSeries.filter(v => v != null), 10)
  const yMax = Math.ceil(maxVol / 10) * 10 + 10

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300">
          20-Day Rolling Volatility (Annualised)
        </h2>
        {currentVol != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Current</span>
            <span
              className="text-sm font-bold font-mono px-2 py-0.5 rounded"
              style={{ color, background: `${color}18` }}
            >
              {currentVol.toFixed(1)}%
            </span>
            <span className="text-xs font-semibold" style={{ color }}>
              {volLabel(currentVol)}
            </span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
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
            domain={[0, yMax]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}%`}
            width={42}
          />
          <Tooltip content={<VolTooltip />} />
          {/* Reference thresholds */}
          <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.35} />
          <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.35} />
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="vol"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-2 text-[10px] text-slate-600">
        <span className="text-emerald-400/70">— &lt;20% low</span>
        <span className="text-amber-400/70">— 20–40% moderate</span>
        <span className="text-red-400/70">— &gt;40% high</span>
      </div>
    </div>
  )
}
