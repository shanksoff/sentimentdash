import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TickerSidebar({ activeTicker, onSelect }) {
  const [tickers, setTickers] = useState([])

  useEffect(() => {
    axios.get('/api/tickers')
      .then(r => setTickers(r.data))
      .catch(() => {})
  }, [])

  return (
    <div className="card h-full flex flex-col overflow-hidden p-0">
      <div className="px-3 pt-3 pb-2 shrink-0 border-b border-border">
        <p className="metric-label">Tickers</p>
      </div>
      <div className="overflow-auto flex-1">
        {tickers.map(t => {
          const isActive = t.symbol === activeTicker
          const pos = t.pct_change != null && t.pct_change >= 0
          const color = t.pct_change == null ? '#64748b' : pos ? '#10b981' : '#ef4444'
          return (
            <button
              key={t.symbol}
              onClick={() => onSelect(t.symbol)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors border-l-2 ${
                isActive
                  ? 'bg-card border-emerald-500 text-slate-100'
                  : 'border-transparent hover:bg-white/[0.04] text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="font-mono text-xs font-semibold truncate">{t.symbol}</span>
              <div className="text-right shrink-0">
                {t.latest_price != null && (
                  <p className="text-xs font-mono text-slate-300">${t.latest_price.toFixed(2)}</p>
                )}
                {t.pct_change != null && (
                  <p className="text-[10px] font-mono" style={{ color }}>
                    {pos ? '+' : ''}{t.pct_change.toFixed(2)}%
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
