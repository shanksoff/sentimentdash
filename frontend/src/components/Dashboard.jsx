import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import OverlayChart from './OverlayChart'
import FundamentalsPanel from './FundamentalsPanel'
import IncomeTable from './IncomeTable'
import PerformanceStrip from './PerformanceStrip'
import SentimentPanel from './SentimentPanel'

const DEFAULT_TICKER = 'AAPL'

export default function Dashboard() {
  const [inputValue, setInputValue] = useState(DEFAULT_TICKER)
  const [ticker, setTicker] = useState('')

  const [price, setPrice] = useState([])
  const [sentiment, setSentiment] = useState([])
  const [fundamentals, setFundamentals] = useState(null)
  const [incomeStatement, setIncomeStatement] = useState([])
  const [performance, setPerformance] = useState(null)
  const [selectedSentimentDate, setSelectedSentimentDate] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(false)

  const pollRef = useRef(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const fetchAll = useCallback(async (sym) => {
    if (!sym) return
    stopPolling()
    setLoading(true)
    setError(null)
    setBootstrapping(false)
    setTicker(sym)
    setSelectedSentimentDate(null)

    try {
      const [priceRes, sentRes, fundRes, incRes, perfRes] = await Promise.allSettled([
        axios.get(`/api/price/${sym}`),
        axios.get(`/api/sentiment/${sym}`),
        axios.get(`/api/fundamentals/${sym}`),
        axios.get(`/api/income-statement/${sym}`),
        axios.get(`/api/performance/${sym}`),
      ])

      setPrice(priceRes.status === 'fulfilled' ? priceRes.value.data : [])
      const sentData = sentRes.status === 'fulfilled' ? sentRes.value.data : []
      setSentiment(sentData)
      setFundamentals(fundRes.status === 'fulfilled' ? fundRes.value.data : null)
      setIncomeStatement(incRes.status === 'fulfilled' ? incRes.value.data : [])
      setPerformance(perfRes.status === 'fulfilled' ? perfRes.value.data : null)

      const allFailed = [priceRes, sentRes, fundRes, incRes, perfRes]
        .every(r => r.status === 'rejected')
      if (allFailed) setError(`No data found for "${sym}".`)

      if (sentData.length === 0) {
        setBootstrapping(true)
        pollRef.current = setInterval(async () => {
          try {
            const res = await axios.get(`/api/sentiment/${sym}`)
            if (res.data.length > 0) {
              setSentiment(res.data)
              setBootstrapping(false)
              stopPolling()
            }
          } catch {
            // ignore transient errors during polling
          }
        }, 10000)
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [stopPolling])

  useEffect(() => stopPolling, [stopPolling])

  const handleSearch = (e) => {
    e.preventDefault()
    const sym = inputValue.trim().toUpperCase()
    if (sym) fetchAll(sym)
  }

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center gap-6">
          <span className="text-emerald-400 font-bold text-xl tracking-tight whitespace-nowrap">
            📈 SentimentDash
          </span>
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value.toUpperCase())}
              placeholder="Ticker symbol…"
              className="flex-1 bg-surface border border-border rounded-lg px-4 py-2 text-sm
                         text-slate-200 placeholder-slate-600
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold
                         bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
                         transition-colors"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
          </form>

          {ticker && (
            <span className="text-slate-400 text-sm">
              Showing: <span className="text-slate-100 font-mono font-semibold">{ticker}</span>
              {fundamentals?.company_name && (
                <span className="ml-2 text-slate-500">— {fundamentals.company_name}</span>
              )}
            </span>
          )}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {!ticker && (
          <div className="flex flex-col items-center justify-center py-32 text-slate-600">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-lg">Enter a ticker symbol above to load the dashboard.</p>
          </div>
        )}

        {error && (
          <div className="card border-red-800 bg-red-950/30 text-red-400 text-sm">{error}</div>
        )}

        {bootstrapping && (
          <div className="card border-amber-800 bg-amber-950/20 text-amber-400 text-sm flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
            Fetching and analysing news sentiment — this may take up to a minute…
          </div>
        )}

        {ticker && !loading && (
          <>
            {/* ── Main row: fundamentals + chart/performance ── */}
            <div className="flex gap-6 items-start">
              <div className="w-72 shrink-0">
                <FundamentalsPanel data={fundamentals} />
              </div>

              <div className="flex-1 min-w-0 space-y-4">
                <OverlayChart
                  priceData={price}
                  sentimentData={sentiment}
                  ticker={ticker}
                  selectedDate={selectedSentimentDate}
                  onSentimentClick={setSelectedSentimentDate}
                />
                <PerformanceStrip data={performance} />
              </div>
            </div>

            {/* ── Sentiment news feed ───────────────────────── */}
            <SentimentPanel
              articles={sentiment}
              selectedDate={selectedSentimentDate}
              onClearDate={() => setSelectedSentimentDate(null)}
            />

            {/* ── Income statement ──────────────────────────── */}
            <IncomeTable data={incomeStatement} />
          </>
        )}

        {loading && (
          <div className="flex justify-center py-32">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </main>
    </div>
  )
}
