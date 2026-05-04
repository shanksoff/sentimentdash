const METRICS = [
  { key: 'total_revenue',           label: 'Total Revenue' },
  { key: 'total_operating_expense', label: 'Operating Expenses' },
  { key: 'ebit',                    label: 'EBIT' },
  { key: 'ebitda',                  label: 'EBITDA' },
  { key: 'eps',                     label: 'EPS' },
  { key: 'net_income',              label: 'Net Income' },
  { key: 'net_profit_margin',       label: 'Net Margin', pct: true },
  { key: 'debt_equity',             label: 'Debt / Equity' },
  { key: 'roic',                    label: 'ROIC', pct: true },
  { key: 'roa',                     label: 'ROA', pct: true },
  { key: 'roe',                     label: 'ROE', pct: true },
]

function fmtCell(val, pct = false) {
  if (val == null) return <span className="text-slate-700">—</span>
  if (pct) return `${(val * 100).toFixed(1)}%`
  // Values like revenue are absolute dollars — display in $M
  const abs = Math.abs(val)
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `$${(val / 1e6).toFixed(1)}M`
  return `$${Number(val).toFixed(2)}`
}

export default function IncomeTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card text-slate-600 text-sm text-center py-8">
        No income statement data
      </div>
    )
  }

  // Sort years descending
  const years = [...data].sort((a, b) => b.year - a.year)

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">
        Income Statement — 5-Year Annual
      </h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-6 text-slate-500 font-medium w-44">Metric</th>
            {years.map(y => (
              <th key={y.year} className="text-right py-2 px-4 text-slate-400 font-mono font-semibold">
                FY {y.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m, i) => (
            <tr
              key={m.key}
              className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                i % 2 === 0 ? '' : 'bg-white/[0.01]'
              }`}
            >
              <td className="py-2 pr-6 text-slate-400 font-medium">{m.label}</td>
              {years.map(y => (
                <td key={y.year} className="text-right py-2 px-4 font-mono text-slate-200">
                  {fmtCell(y[m.key], m.pct)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
