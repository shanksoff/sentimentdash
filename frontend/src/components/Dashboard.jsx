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
      <p className="metric-label mb-2">ML Signal · {prediction.horizon_days ?? 5}-Day</p>
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
      <p className="metric-label mb-2">Relative Performance</p>
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
    <div className="card flex flex-col gap-2 h-full overflow-hidden">
      <p className="metric-label">Fundamentals</p>

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

  const [price, setPrice] = useState([])
  const [sentiment, setSentiment] = useState([])
  const [fundamentals, setFundamentals] = useState(null)
  const [incomeStatement, setIncomeStatement] = useState([])
  const [performance, setPerformance] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [regression, setRegression] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [selectedSentimentDate, setSelectedSentimentDate] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [chartTab, setChartTab] = useState('main')

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
    setAnalysis(null)

    try {
      const [priceRes, sentRes, fundRes, incRes, perfRes, forecastRes, regressionRes, predictionRes] = await Promise.allSettled([
        axios.get(`/api/price/${sym}`),
        axios.get(`/api/sentiment/${sym}`),
        axios.get(`/api/fundamentals/${sym}`),
        axios.get(`/api/income-statement/${sym}`),
        axios.get(`/api/performance/${sym}`),
        axios.get(`/api/forecast/${sym}`),
        axios.get(`/api/regression/${sym}`),
        axios.get(`/api/prediction/${sym}`),
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

  // Auto-load default ticker on first visit
  useEffect(() => {
    fetchAll('SPY')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-surface text-slate-200">

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-card/60 backdrop-blur z-10">
        <div className="px-4 py-3 flex items-center gap-4">
          <span className="text-emerald-400 font-bold text-sm tracking-tight whitespace-nowrap">
            📈 S&P 500 Sentiment Dashboard
          </span>
          {ticker && (
            <span className="text-slate-400 text-sm whitespace-nowrap">
              <span className="text-slate-100 font-mono font-semibold">{ticker}</span>
              {fundamentals?.company_name && (
                <span className="ml-2 text-slate-500">— {fundamentals.company_name}</span>
              )}
            </span>
          )}
          {bootstrapping && (
            <div className="ml-auto flex items-center gap-2 text-amber-400 text-xs">
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
              Fetching sentiment…
            </div>
          )}
          {error && <span className="ml-auto text-red-400 text-xs">{error}</span>}
        </div>
      </header>

      {/* ── 4-Column Body ────────────────────────────────────── */}
      <main className="flex-1 flex gap-1.5 p-1.5 overflow-hidden min-h-0">

        {/* Col 1 — Ticker Sidebar */}
        <div className="w-44 shrink-0 flex flex-col overflow-hidden">
          <TickerSidebar activeTicker={ticker} onSelect={fetchAll} />
        </div>

        {/* Col 2 — Signal / Performance / Fundamentals */}
        <div className="w-56 shrink-0 flex flex-col gap-1.5 overflow-hidden">
          <div className="shrink-0">
            <SignalCard prediction={prediction} forecast={forecast} price={price} />
          </div>
          <div className="shrink-0">
            <PerfCard data={performance} />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <FundCard data={fundamentals} />
          </div>
        </div>

        {/* Col 3 — Charts (top) + News (bottom) */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 overflow-hidden">

          {/* Chart pane with tabs */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden card p-0">
            {/* Tab bar */}
            <div className="flex shrink-0 border-b border-border px-2 pt-2 gap-1 flex-wrap">
              {[
                { key: 'main',       label: 'Main' },
                { key: 'forecast',   label: 'Forecast' },
                { key: 'prediction', label: '5dF' },
                { key: 'sentiment',  label: 'Sent. vs Price' },
                { key: 'regression', label: 'Regression' },
                { key: 'volatility', label: 'Volatility' },
                { key: 'income',     label: 'Income Statement' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setChartTab(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors border-b-2 -mb-px ${
                    chartTab === key
                      ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}
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

        {/* Col 4 — AI Analysis */}
        <div className="w-64 shrink-0 overflow-auto">
          <AnalysisPanel data={analysis} loading={analysisLoading} ticker={ticker} />
        </div>

      </main>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

    </div>
  )
}
