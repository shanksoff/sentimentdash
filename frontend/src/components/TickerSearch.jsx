import { useState, useRef, useEffect, useCallback } from 'react'

// Top 25 S&P 500 companies by index weight + SPY benchmark
const TICKERS = [
  { symbol: 'NVDA',  name: 'NVIDIA Corporation' },
  { symbol: 'AAPL',  name: 'Apple Inc.' },
  { symbol: 'MSFT',  name: 'Microsoft Corporation' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  { symbol: 'GOOG',  name: 'Alphabet Inc. (Class C)' },
  { symbol: 'AVGO',  name: 'Broadcom Inc.' },
  { symbol: 'META',  name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA',  name: 'Tesla Inc.' },
  { symbol: 'WMT',   name: 'Walmart Inc.' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway (Class B)' },
  { symbol: 'LLY',   name: 'Eli Lilly & Co.' },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { symbol: 'MU',    name: 'Micron Technology Inc.' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices Inc.' },
  { symbol: 'XOM',   name: 'Exxon Mobil Corporation' },
  { symbol: 'V',     name: 'Visa Inc.' },
  { symbol: 'INTC',  name: 'Intel Corporation' },
  { symbol: 'ORCL',  name: 'Oracle Corporation' },
  { symbol: 'JNJ',   name: 'Johnson & Johnson' },
  { symbol: 'COST',  name: 'Costco Wholesale Corporation' },
  { symbol: 'MA',    name: 'Mastercard Inc.' },
  { symbol: 'CAT',   name: 'Caterpillar Inc.' },
  { symbol: 'BAC',   name: 'Bank of America Corporation' },
  { symbol: 'NFLX',  name: 'Netflix Inc.' },
  { symbol: 'SPY',   name: 'SPDR S&P 500 ETF (Benchmark)' },
]

export default function TickerSearch({ onSearch, loading }) {
  const [query, setQuery]             = useState('')
  const [open, setOpen]               = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef(null)
  const listRef  = useRef(null)
  const wrapRef  = useRef(null)

  // Filter: symbol prefix match first, then company name contains
  const filtered = query.trim().length === 0
    ? TICKERS
    : (() => {
        const q = query.trim().toUpperCase()
        const symMatch  = TICKERS.filter(t => t.symbol.startsWith(q))
        const nameMatch = TICKERS.filter(
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
          placeholder="Search top 25 S&P 500 or SPY…"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-surface border border-border rounded-lg px-4 py-2 pr-8 text-sm
                     text-slate-200 placeholder-slate-600
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none select-none text-xs">
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
