function PerfCell({ label, value }) {
  const isNull = value == null
  const pct = isNull ? null : (value * 100).toFixed(2)
  const colorClass = isNull
    ? 'text-slate-600'
    : value >= 0
      ? 'text-emerald-400'
      : 'text-red-400'

  return (
    <div className="card flex-1 text-center">
      <p className="metric-label">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${colorClass}`}>
        {isNull ? '—' : `${value >= 0 ? '+' : ''}${pct}%`}
      </p>
    </div>
  )
}

export default function PerformanceStrip({ data }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest px-1">
        Relative Performance
      </h2>
      <div className="flex gap-3">
        <PerfCell label="1 Month"  value={data?.perf_1m} />
        <PerfCell label="3 Months" value={data?.perf_3m} />
        <PerfCell label="6 Months" value={data?.perf_6m} />
        <PerfCell label="12 Months" value={data?.perf_12m} />
      </div>
    </div>
  )
}
