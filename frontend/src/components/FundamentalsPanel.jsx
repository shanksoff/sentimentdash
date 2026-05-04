function fmt(val, opts = {}) {
  if (val == null) return '—'
  const { prefix = '', suffix = '', decimals = 2, pct = false } = opts
  const n = pct ? (val * 100) : val
  return `${prefix}${Number(n).toFixed(decimals)}${suffix}`
}

function RangeBar({ low, high, current }) {
  if (low == null || high == null || current == null) return null
  const range = high - low
  if (range === 0) return null
  const pct = Math.min(100, Math.max(0, ((current - low) / range) * 100))
  return (
    <div className="mt-2">
      <div className="relative h-1.5 rounded-full bg-border">
        <div
          className="absolute top-0 left-0 h-1.5 rounded-full bg-emerald-500/40"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow shadow-emerald-400/40"
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
        <span>${Number(low).toFixed(2)}</span>
        <span>${Number(high).toFixed(2)}</span>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="card">
      <p className="metric-label">{label}</p>
      <p className="metric-value mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function FundamentalsPanel({ data }) {
  if (!data) {
    return (
      <div className="card text-slate-600 text-sm text-center py-10">
        No fundamentals data
      </div>
    )
  }

  const currentPrice = data.week_52_high && data.week_52_low
    ? ((parseFloat(data.week_52_high) + parseFloat(data.week_52_low)) / 2)
    : null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest px-1">
        Fundamentals
      </h2>

      {/* 52-week range */}
      <div className="card">
        <p className="metric-label">52-Week Range</p>
        <p className="metric-value mt-1">
          ${fmt(data.week_52_low, { decimals: 2 })} – ${fmt(data.week_52_high, { decimals: 2 })}
        </p>
        <RangeBar
          low={parseFloat(data.week_52_low)}
          high={parseFloat(data.week_52_high)}
          current={currentPrice}
        />
      </div>

      {/* Valuation */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="P/E Ratio"     value={fmt(data.pe_ratio)} />
        <MetricCard label="P/B Ratio"     value={fmt(data.price_to_book)} />
        <MetricCard label="P/S Ratio"     value={fmt(data.price_to_sales)} />
        <MetricCard label="EPS (TTM)"     value={fmt(data.eps, { prefix: '$' })} />
      </div>

      {/* Returns */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="ROE"
          value={fmt(data.roe, { pct: true, suffix: '%' })}
        />
        <MetricCard
          label="Debt / Equity"
          value={fmt(data.debt_to_equity)}
        />
      </div>

      {/* Dividends */}
      <div className="card space-y-2">
        <p className="metric-label">Dividends</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-slate-500">Rate</span>
          <span className="font-mono text-slate-200 text-right">
            {fmt(data.dividend_per_share, { prefix: '$' })}
          </span>
          <span className="text-slate-500">Payout</span>
          <span className="font-mono text-slate-200 text-right">
            {fmt(data.dividend_payout_ratio, { pct: true, suffix: '%' })}
          </span>
          <span className="text-slate-500">5yr Growth</span>
          <span className="font-mono text-slate-200 text-right">
            {fmt(data.dividend_5yr_growth, { suffix: '%' })}
          </span>
          <span className="text-slate-500">Last Date</span>
          <span className="font-mono text-slate-200 text-right text-xs">
            {data.last_dividend_date ?? '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
