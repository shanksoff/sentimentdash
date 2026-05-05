import { useState, useRef, useEffect, useCallback } from 'react'

const POPULAR_TICKERS = [
  // Technology
  { symbol: 'AAPL',  name: 'Apple Inc.' },
  { symbol: 'MSFT',  name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  { symbol: 'GOOG',  name: 'Alphabet Inc. (Class C)' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.' },
  { symbol: 'META',  name: 'Meta Platforms Inc.' },
  { symbol: 'NVDA',  name: 'NVIDIA Corporation' },
  { symbol: 'TSLA',  name: 'Tesla Inc.' },
  { symbol: 'NFLX',  name: 'Netflix Inc.' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices' },
  { symbol: 'INTC',  name: 'Intel Corporation' },
  { symbol: 'ORCL',  name: 'Oracle Corporation' },
  { symbol: 'CRM',   name: 'Salesforce Inc.' },
  { symbol: 'ADBE',  name: 'Adobe Inc.' },
  { symbol: 'QCOM',  name: 'Qualcomm Inc.' },
  { symbol: 'AVGO',  name: 'Broadcom Inc.' },
  { symbol: 'TXN',   name: 'Texas Instruments' },
  { symbol: 'NOW',   name: 'ServiceNow Inc.' },
  { symbol: 'SNOW',  name: 'Snowflake Inc.' },
  { symbol: 'UBER',  name: 'Uber Technologies' },
  { symbol: 'LYFT',  name: 'Lyft Inc.' },
  { symbol: 'SHOP',  name: 'Shopify Inc.' },
  { symbol: 'SQ',    name: 'Block Inc.' },
  { symbol: 'SPOT',  name: 'Spotify Technology' },
  { symbol: 'PLTR',  name: 'Palantir Technologies' },
  // Finance
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { symbol: 'BAC',   name: 'Bank of America Corp.' },
  { symbol: 'GS',    name: 'Goldman Sachs Group' },
  { symbol: 'MS',    name: 'Morgan Stanley' },
  { symbol: 'WFC',   name: 'Wells Fargo & Company' },
  { symbol: 'C',     name: 'Citigroup Inc.' },
  { symbol: 'AXP',   name: 'American Express Company' },
  { symbol: 'V',     name: 'Visa Inc.' },
  { symbol: 'MA',    name: 'Mastercard Inc.' },
  { symbol: 'PYPL',  name: 'PayPal Holdings' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway (Class B)' },
  // Healthcare
  { symbol: 'JNJ',   name: 'Johnson & Johnson' },
  { symbol: 'UNH',   name: 'UnitedHealth Group' },
  { symbol: 'PFE',   name: 'Pfizer Inc.' },
  { symbol: 'ABBV',  name: 'AbbVie Inc.' },
  { symbol: 'MRK',   name: 'Merck & Co.' },
  { symbol: 'LLY',   name: 'Eli Lilly and Company' },
  { symbol: 'AMGN',  name: 'Amgen Inc.' },
  { symbol: 'GILD',  name: 'Gilead Sciences' },
  { symbol: 'BMY',   name: 'Bristol-Myers Squibb' },
  // Consumer
  { symbol: 'WMT',   name: 'Walmart Inc.' },
  { symbol: 'COST',  name: 'Costco Wholesale' },
  { symbol: 'TGT',   name: 'Target Corporation' },
  { symbol: 'HD',    name: 'Home Depot Inc.' },
  { symbol: 'MCD',   name: "McDonald's Corporation" },
  { symbol: 'SBUX',  name: 'Starbucks Corporation' },
  { symbol: 'NKE',   name: 'Nike Inc.' },
  { symbol: 'DIS',   name: 'The Walt Disney Company' },
  { symbol: 'KO',    name: 'The Coca-Cola Company' },
  { symbol: 'PEP',   name: 'PepsiCo Inc.' },
  { symbol: 'PG',    name: 'Procter & Gamble Co.' },
  // Energy
  { symbol: 'XOM',   name: 'Exxon Mobil Corporation' },
  { symbol: 'CVX',   name: 'Chevron Corporation' },
  { symbol: 'COP',   name: 'ConocoPhillips' },
  { symbol: 'SLB',   name: 'Schlumberger Limited' },
  // ETFs
  { symbol: 'SPY',   name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ',   name: 'Invesco QQQ (NASDAQ-100 ETF)' },
  { symbol: 'IWM',   name: 'iShares Russell 2000 ETF' },
  { symbol: 'VTI',   name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'VOO',   name: 'Vanguard S&P 500 ETF' },
  { symbol: 'GLD',   name: 'SPDR Gold Shares ETF' },
]

export default function TickerSearch({ onSearch, loading }) {
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef  = useRef(null)
  const listRef   = useRef(null)
  const wrapRef   = useRef(null)

  // Filter list: match symbol prefix first, then company name contains
  const filtered = query.trim().length === 0
    ? POPULAR_TICKERS
    : (() => {
        const q = query.trim().toUpperCase()
        const symMatch  = POPULAR_TICKERS.filter(t => t.symbol.startsWith(q))
        const nameMatch = POPULAR_TICKERS.filter(
          t => !t.symbol.startsWith(q) && t.name.toUpperCase().includes(q)
        )
        return [...symMatch, ...nameMatch]
      })()

  const commit = useCallback((symbol) => {
    setQuery(symbol)
    setOpen(false)
    setHighlighted(-1)
    onSearch(symbol.trim().toUpperCase())
  }, [onSearch])

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0 && filtered[highlighted]) {
        commit(filtered[highlighted].symbol)
      } else if (query.trim()) {
        commit(query.trim().toUpperCase())
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlighted(-1)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted]
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setHighlighted(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} className="relative flex gap-2 flex-1 max-w-md">
      {/* Input */}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlighted(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search ticker or company…"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-surface border border-border rounded-lg px-4 py-2 pr-8 text-sm
                     text-slate-200 placeholder-slate-600
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60"
        />
        {/* chevron */}
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none select-none text-xs"
        >
          ▾
        </span>
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute top-full left-0 z-50 mt-1 w-full max-h-72 overflow-y-auto
                     bg-card border border-border rounded-lg shadow-xl text-sm"
        >
          {filtered.map((t, i) => (
            <li
              key={t.symbol}
              onMouseDown={(e) => { e.preventDefault(); commit(t.symbol) }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                ${i === highlighted
                  ? 'bg-emerald-600/20 text-slate-100'
                  : 'text-slate-300 hover:bg-white/[0.04]'
                }`}
            >
              <span className="font-mono font-semibold text-emerald-400 w-16 shrink-0">
                {t.symbol}
              </span>
              <span className="text-slate-400 truncate">{t.name}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Search button */}
      <button
        type="button"
        disabled={loading}
        onClick={() => query.trim() && commit(query.trim().toUpperCase())}
        className="px-5 py-2 rounded-lg text-sm font-semibold
                   bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
                   transition-colors whitespace-nowrap"
      >
        {loading ? 'Loading…' : 'Search'}
      </button>
    </div>
  )
}
