import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import TickerSidebar from './TickerSidebar'
import OverlayChart from './OverlayChart'
import IncomeTable from './IncomeTable'
import SentimentPanel from './SentimentPanel'
import VolatilityPanel from './VolatilityPanel'
import ForecastPanel from './ForecastPanel'
import RegressionPanel from './RegressionPanel'
import AnalysisPanel from './AnalysisPanel'
import SentimentPriceChart from './SentimentPriceChart'
import PredictionPanel from './PredictionPanel'
import MethodologyPanel from './MethodologyPanel'
import DecompositionPanel from './DecompositionPanel'
import RollingCorrelationPanel from './RollingCorrelationPanel'
import InfoTooltip from './InfoTooltip'

// ─── Col 2 compact components ────────────────────────────────

const SIGNAL_CFG = {
  Watch: { color: '#10b981', label: 'WATCH' },
  Hold:  { color: '#f59e0b', label: 'HOLD'  },
  Avoid: { color: '#ef4444', label: 'AVOID' },
}

function SignalCard({ prediction, forecast, price }) {
  if (!prediction) return (
    <div className="card flex items-center justify-center text-slate-600 text-xs py-6">No prediction</div>
  )
  const cfg = SIGNAL_CFG[prediction.signal] ?? SIGNAL_CFG.Hold
  const prob = prediction.prob_up != null ? Math.round(prediction.prob_up * 100) : null

  let target = null, chg = null
  if (forecast?.forecast?.length && price?.length) {
    const idx = Math.min((prediction.horizon_days ?? 5) - 1, forecast.forecast.length - 1)
    const pt = forecast.forecast[idx]
    const last = parseFloat(price[price.length - 1]?.close)
    if (pt && last) {
      target = pt.yhat.toFixed(2)
      chg = (((pt.yhat - last) / last) * 100).toFixed(2)
    }
  }

  return (
    <div className="card" style={{ borderColor: cfg.color + '50' }}>
      <div className="flex items-center mb-2">
        <p className="metric-label">ML Signal · {prediction.horizon_days ?? 5}-Day</p>
        <InfoTooltip text="A Random Forest classifier predicts whether the stock will close higher or lower in 5 trading days. Features include RSI, Bollinger Band position, price momentum, and rolling sentiment scores. Watch = P(up) ≥ 60%, Hold = 40–60%, Avoid = < 40%. See the Methodology tab for full details." />
      </div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-2xl font-bold font-mono" style={{ color: cfg.color }}>{cfg.label}</span>
        {prob != null && <span className="text-xs text-slate-500">P(up) <span className="font-mono font-semibold" style={{ color: cfg.color }}>{prob}%</span></span>}
      </div>
      {target && (
        <p className="text-xs text-slate-500 mt-1">
          Target <span className="font-mono" style={{ color: cfg.color }}>${target}</span>
          <span className="ml-1" style={{ color: cfg.color }}>{chg >= 0 ? '↑' : '↓'}{Math.abs(chg)}%</span>
        </p>
      )}
    </div>
  )
}

function PerfCard({ data }) {
  const rows = [
    { label: '1M',  val: data?.perf_1m  },
    { label: '3M',  val: data?.perf_3m  },
    { label: '6M',  val: data?.perf_6m  },
    { label: '12M', val: data?.perf_12m },
  ]
  return (
    <div className="card">
      <div className="flex items-center mb-2">
        <p className="metric-label">Relative Performance</p>
        <InfoTooltip text="Total price return over the trailing 1, 3, 6, and 12 months from daily closing prices. Raw price return only — dividends not included. Use this to gauge whether recent sentiment and ML signals are aligned with or diverging from longer-term price trends." />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map(({ label, val }) => {
          const pct = val != null ? (val * 100).toFixed(2) : null
          const color = pct == null ? '#64748b' : pct >= 0 ? '#10b981' : '#ef4444'
          return (
            <div key={label} className="flex justify-between items-baseline">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
              <span className="text-sm font-mono font-semibold" style={{ color }}>
                {pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct}%`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FundCard({ data }) {
  if (!data) return (
    <div className="card flex items-center justify-center text-slate-600 text-xs">No fundamentals</div>
  )
  const f = (v, pre = '', suf = '', pct = false) => {
    if (v == null) return '—'
    return `${pre}${Number(pct ? v * 100 : v).toFixed(2)}${suf}`
  }
  const low = parseFloat(data.week_52_low)
  const high = parseFloat(data.week_52_high)
  const mid = (low + high) / 2
  const pct52 = high > low ? Math.min(100, Math.max(0, ((mid - low) / (high - low)) * 100)) : 50

  const rows = [
    ['P/E',      f(data.pe_ratio)],
    ['P/B',      f(data.price_to_book)],
    ['P/S',      f(data.price_to_sales)],
    ['EPS',      f(data.eps, '$')],
    ['ROE',      f(data.roe, '', '%', true)],
    ['D/E',      f(data.debt_to_equity)],
    ['Div Rate', f(data.dividend_per_share, '$')],
    ['Payout',   f(data.dividend_payout_ratio, '', '%', true)],
    ['5yr Div↑', f(data.dividend_5yr_growth, '', '%')],
  ]

  return (
    <div className="card flex flex-col gap-2 flex-1 overflow-hidden">
      <div className="flex items-center">
        <p className="metric-label">Fundamentals</p>
        <InfoTooltip text="Key fundamental ratios sourced from Yahoo Finance. P/E = price-to-earnings, P/B = price-to-book, P/S = price-to-sales, EPS = earnings per share, ROE = return on equity, D/E = debt-to-equity ratio. The 52W range bar shows where the midpoint of the 52-week high/low sits." />
      </div>

      {/* 52-week range */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-600 mb-1">
          <span>${f(data.week_52_low)}</span>
          <span className="text-slate-500">52W Range</span>
          <span>${f(data.week_52_high)}</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-border">
          <div className="absolute h-1.5 rounded-full bg-emerald-500/40" style={{ width: `${pct52}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400" style={{ left: `calc(${pct52}% - 4px)` }} />
        </div>
      </div>

      {/* Metric rows */}
      <div className="overflow-auto flex-1 space-y-1.5">
        {rows.map(([label, val]) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-slate-500">{label}</span>
            <span className="font-mono text-slate-200">{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [ticker, setTicker] = useState('')
  const [tickers, setTickers] = useState([])

  const [price, setPrice] = useState([])
  const [sentiment, setSentiment] = useState([])
  const [fundamentals, setFundamentals] = useState(null)
  const [incomeStatement, setIncomeStatement] = useState([])
  const [performance, setPerformance] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [regression, setRegression] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [decomposition, setDecomposition] = useState(null)
  const [rollingCorr, setRollingCorr] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [selectedSentimentDate, setSelectedSentimentDate] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [chartTab, setChartTab] = useState('main')
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const [fundOpen, setFundOpen] = useState(false)

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
    setForecast(null)
    setRegression(null)
    setPrediction(null)
    setDecomposition(null)
    setRollingCorr(null)
    setAnalysis(null)

    try {
      const [priceRes, sentRes, fundRes, incRes, perfRes, forecastRes, regressionRes, predictionRes, decompRes, rollingCorrRes] = await Promise.allSettled([
        axios.get(`/api/price/${sym}`),
        axios.get(`/api/sentiment/${sym}`),
        axios.get(`/api/fundamentals/${sym}`),
        axios.get(`/api/income-statement/${sym}`),
        axios.get(`/api/performance/${sym}`),
        axios.get(`/api/forecast/${sym}`),
        axios.get(`/api/regression/${sym}`),
        axios.get(`/api/prediction/${sym}`),
        axios.get(`/api/decomposition/${sym}`),
        axios.get(`/api/rolling-correlation/${sym}`),
      ])

      setPrice(priceRes.status === 'fulfilled' ? priceRes.value.data : [])
      const sentData = sentRes.status === 'fulfilled' ? sentRes.value.data : []
      setSentiment(sentData)
      setFundamentals(fundRes.status === 'fulfilled' ? fundRes.value.data : null)
      setIncomeStatement(incRes.status === 'fulfilled' ? incRes.value.data : [])
      setPerformance(perfRes.status === 'fulfilled' ? perfRes.value.data : null)
      setForecast(forecastRes.status === 'fulfilled' ? forecastRes.value.data : null)
      setRegression(regressionRes.status === 'fulfilled' ? regressionRes.value.data : null)
      setPrediction(predictionRes.status === 'fulfilled' ? predictionRes.value.data : null)
      setDecomposition(decompRes.status === 'fulfilled' ? decompRes.value.data : null)
      setRollingCorr(rollingCorrRes.status === 'fulfilled' ? rollingCorrRes.value.data : null)

      // AI analysis fires after main data — Gemini takes a few seconds
      setAnalysisLoading(true)
      axios.get(`/api/analysis/${sym}`)
        .then(r => setAnalysis(r.data))
        .catch(() => setAnalysis(null))
        .finally(() => setAnalysisLoading(false))

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

  // Fetch ticker list for mobile dropdown
  useEffect(() => {
    axios.get('/api/tickers')
      .then(r => setTickers(r.data.map(t => t.symbol).sort()))
      .catch(() => {})
  }, [])

  // Auto-load default ticker on first visit
  useEffect(() => {
    fetchAll('SPY')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative min-h-screen lg:h-screen flex flex-col lg:overflow-hidden bg-surface text-slate-200">

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-card/60 backdrop-blur z-10">
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-bold text-sm tracking-tight whitespace-nowrap" style={{ color: '#00E5B3' }}>
            📈 S&P 500 Sentiment Dashboard
          </span>

          <button
            onClick={() => setMethodologyOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-[#1E2C3E] text-slate-400 hover:text-[#00E5B3] hover:border-[#00E5B3]/40 transition-colors shrink-0"
          >
            🔬 How it works
          </button>

          {/* Mobile ticker picker — hidden on desktop (sidebar handles it there) */}
          {tickers.length > 0 && (
            <select
              className="lg:hidden ml-1 bg-card border border-border rounded px-2 py-1 text-xs text-slate-200 font-mono"
              value={ticker}
              onChange={e => fetchAll(e.target.value)}
            >
              {tickers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {ticker && (
            <span className="hidden lg:inline text-slate-400 text-sm whitespace-nowrap">
              <span className="text-slate-100 font-mono font-semibold">{ticker}</span>
              {fundamentals?.company_name && (
                <span className="ml-2 text-slate-500">— {fundamentals.company_name}</span>
              )}
            </span>
          )}
          {bootstrapping && (
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
              Fetching sentiment…
            </div>
          )}
          {error && <span className="text-red-400 text-xs">{error}</span>}

        </div>
      </header>

      {/* ── 4-Column Body ────────────────────────────────────── */}
      <main className="flex-1 flex flex-col lg:flex-row gap-1.5 p-1.5 overflow-auto lg:overflow-hidden lg:min-h-0">

        {/* Col 1 — Ticker Sidebar (desktop only) */}
        <div className="hidden lg:flex w-44 shrink-0 flex-col overflow-hidden">
          <TickerSidebar activeTicker={ticker} onSelect={fetchAll} />
        </div>

        {/* Col 2 — Signal / Performance / Fundamentals */}
        <div className="flex flex-col gap-1.5 lg:w-56 lg:shrink-0 lg:overflow-hidden">
          <SignalCard prediction={prediction} forecast={forecast} price={price} />
          <PerfCard data={performance} />

          {/* Fundamentals — collapsible on mobile, always open on desktop */}
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col">
            {/* Mobile toggle */}
            <button
              className="lg:hidden w-full flex items-center justify-between px-3 py-2 card text-xs text-slate-400"
              onClick={() => setFundOpen(o => !o)}
            >
              <span className="font-medium text-slate-300">Fundamentals</span>
              <span className="text-slate-500">{fundOpen ? '▲ hide' : '▼ show'}</span>
            </button>
            <div className={`${fundOpen ? 'block' : 'hidden'} lg:block lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col`}>
              <FundCard data={fundamentals} />
            </div>
          </div>
        </div>

        {/* Col 3 — Charts (top) + News (bottom) */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 lg:overflow-hidden">

          {/* Chart pane with tabs */}
          <div className="h-[500px] lg:h-auto lg:flex-1 lg:min-h-0 flex flex-col overflow-hidden card p-0">
            {/* Tab bar — scrollable on mobile */}
            <div className="flex shrink-0 border-b border-border px-2 pt-2 gap-1 overflow-x-auto">
              {[
                { key: 'main',        label: 'Main' },
                { key: 'forecast',    label: 'Forecast' },
                { key: 'prediction',  label: '5dF' },
                { key: 'sentiment',   label: 'Sent. vs Price' },
                { key: 'regression',  label: 'Regression' },
                { key: 'volatility',  label: 'Volatility' },
                { key: 'income',       label: 'Income Statement' },
                { key: 'decomp',       label: 'Decomposition' },
                { key: 'rolling-corr', label: 'Rolling Corr.' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setChartTab(key)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-t transition-colors border-b-2 -mb-px ${
                    chartTab === key
                      ? 'border-[#00E5B3]'
                      : 'border-transparent hover:text-slate-300'
                  }`}
                  style={chartTab === key ? { color: '#00E5B3' } : {}}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Chart content */}
            <div className="flex-1 min-h-0 overflow-auto p-3">
              {chartTab === 'main' && (
                <OverlayChart
                  priceData={price}
                  sentimentData={sentiment}
                  ticker={ticker}
                  selectedDate={selectedSentimentDate}
                  onSentimentClick={setSelectedSentimentDate}
                />
              )}
              {chartTab === 'forecast' && (
                <ForecastPanel forecastData={forecast} priceData={price} ticker={ticker} />
              )}
              {chartTab === 'prediction' && (
                <PredictionPanel data={prediction} ticker={ticker} forecastData={forecast} priceData={price} />
              )}
              {chartTab === 'sentiment' && (
                <SentimentPriceChart priceData={price} sentimentData={sentiment} ticker={ticker} />
              )}
              {chartTab === 'regression' && (
                <RegressionPanel data={regression} />
              )}
              {chartTab === 'volatility' && (
                <VolatilityPanel priceData={price} />
              )}
              {chartTab === 'income' && (
                <IncomeTable data={incomeStatement} />
              )}
              {chartTab === 'decomp' && (
                <DecompositionPanel data={decomposition} ticker={ticker} />
              )}
              {chartTab === 'rolling-corr' && (
                <RollingCorrelationPanel data={rollingCorr} ticker={ticker} />
              )}
            </div>
          </div>

          {/* News feed */}
          <div className="h-52 shrink-0 overflow-auto">
            <SentimentPanel
              articles={sentiment}
              selectedDate={selectedSentimentDate}
              onClearDate={() => setSelectedSentimentDate(null)}
            />
          </div>
        </div>

        {/* Col 4 — AI Analysis (desktop only) */}
        <div className="hidden lg:block lg:w-64 lg:shrink-0 overflow-auto">
          <AnalysisPanel data={analysis} loading={analysisLoading} ticker={ticker} />
        </div>

      </main>

      {/* ── AI FAB (mobile only) ─────────────────────────────── */}
      <button
        className="lg:hidden fixed bottom-5 right-5 z-30 rounded-full shadow-xl flex items-center justify-center text-xl transition-colors"
        style={{ background: '#00E5B3', width: 52, height: 52 }}
        onClick={() => setAiDrawerOpen(true)}
        aria-label="Open AI analysis"
      >
        ✨
      </button>

      {/* ── AI Bottom Drawer (mobile only) ──────────────────── */}
      {aiDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setAiDrawerOpen(false)}
          />
          {/* Sheet */}
          <div className="relative bg-surface rounded-t-2xl max-h-[82vh] flex flex-col shadow-2xl">
            {/* Drag handle */}
            <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto" />
            </div>
            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <span className="text-sm font-semibold text-slate-300">✨ AI Analysis</span>
              <button
                onClick={() => setAiDrawerOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="overflow-auto flex-1 px-3 pb-6">
              <AnalysisPanel data={analysis} loading={analysisLoading} ticker={ticker} />
            </div>
          </div>
        </div>
      )}

      {/* ── Methodology Drawer ───────────────────────────────── */}
      {methodologyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMethodologyOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-lg h-full flex flex-col shadow-2xl"
            style={{ background: '#0C1018', borderLeft: '1px solid #1E2C3E' }}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[#1E2C3E]">
              <div className="flex items-center gap-2">
                <span>🔬</span>
                <h2 className="text-sm font-semibold text-slate-200">How It Works</h2>
              </div>
              <button
                onClick={() => setMethodologyOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <MethodologyPanel />
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00E5B3', borderTopColor: 'transparent' }} />
        </div>
      )}

    </div>
  )
}
