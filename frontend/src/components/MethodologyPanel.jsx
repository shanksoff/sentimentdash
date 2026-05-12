const SECTIONS = [
  {
    title: 'Sentiment Scoring',
    icon: '📰',
    body: `Headlines are scraped daily from financial RSS feeds (Seeking Alpha, Yahoo Finance, Moomoo, and others) for each of the 26 tracked tickers. Each article is then scored 1–10 by Gemini AI, where 1 is strongly bearish and 10 is strongly bullish. The daily average of these scores forms the sentiment overlay visible on the main chart.

A score of 5 is neutral. Scores above 7 indicate broadly positive news coverage; below 3 indicates significant negative coverage. Because sentiment is derived from headlines rather than price action, it can lead or lag the market — which is what the regression panel measures.`,
  },
  {
    title: 'ML Signal — Watch / Hold / Avoid',
    icon: '🤖',
    body: `A Random Forest classifier is trained on roughly 60 days of daily features per ticker. Features include:

  · RSI (14-day)
  · Bollinger Band position (where price sits relative to upper/lower bands)
  · 1-day, 5-day, and 20-day price momentum
  · 7-day and 14-day rolling average sentiment score
  · Day-over-day sentiment change

The model predicts whether the stock will close higher or lower 5 trading days from now. The output is a probability of an upward move (P(up)):

  · Watch  →  P(up) ≥ 60%
  · Hold   →  40% ≤ P(up) < 60%
  · Avoid  →  P(up) < 40%

The model is retrained nightly. It is a directional signal only — not a price target. Past signal accuracy is shown in the badge below the signal badge.`,
  },
  {
    title: 'ARIMA Price Forecast',
    icon: '📈',
    body: `ARIMA (AutoRegressive Integrated Moving Average) is a classical time-series model fit to the last 60 days of daily closing prices. It decomposes the series into trend, autocorrelation, and a moving-average error component, then extrapolates 7 trading days forward.

The shaded band is the 95% confidence interval — it widens over time because uncertainty compounds. A narrow band means recent price action has been stable and trend-consistent; a wide band means recent volatility makes the forecast less reliable.

ARIMA captures linear momentum and mean-reversion but cannot anticipate earnings surprises, macro events, or sudden sentiment shifts. It should be read alongside the sentiment overlay and ML signal, not in isolation.`,
  },
  {
    title: 'Sentiment vs. Price Regression',
    icon: '📊',
    body: `The regression panel plots each trading day as a point: x-axis = that day's average sentiment score, y-axis = the next day's price return (%). The regression line is a simple OLS fit.

If the slope is positive and the R² is meaningful, it suggests higher sentiment days tend to precede positive price moves for this ticker. R² measures how much of the variance in next-day returns is explained by sentiment alone.

In practice, R² is typically low (0.02–0.15) — sentiment is one of many factors. A low R² does not mean sentiment is useless; it means the relationship exists but is noisy. The value of sentiment is most visible in aggregate over many signals, not on any single day.`,
  },
  {
    title: 'Relative Performance',
    icon: '⚡',
    body: `Shows the ticker's total price return over the trailing 1, 3, 6, and 12 months, calculated from daily closing prices in the database.

This is raw price return, not total return (dividends are not included). It is shown to give context for whether recent sentiment and ML signals are aligned with longer-term price trends, or whether they are diverging.`,
  },
  {
    title: 'Rolling Volatility',
    icon: '〰️',
    body: `Volatility is computed as the 30-day rolling standard deviation of daily log returns, annualised by multiplying by √252 (trading days per year).

Colour bands:
  · Green  →  below 20% annualised — low volatility, stable price action
  · Amber  →  20–35% — moderate, typical for most large-caps
  · Red    →  above 35% — high volatility, elevated risk

Higher volatility makes the ARIMA forecast less reliable and widens ML confidence bounds. It does not indicate direction — a stock can be highly volatile in either direction.`,
  },
  {
    title: 'Data & Limitations',
    icon: '⚠',
    body: `All data is sourced from public RSS feeds and free-tier financial APIs. Sentiment coverage density varies by ticker — large-caps (SPY, NVDA, AAPL) have more articles per day than smaller names, which produces more reliable daily averages.

Historical sentiment before the scraper came online (approximately May 2026) is sparse for many tickers. Price data goes back further via Yahoo Finance.

Nothing on this dashboard constitutes financial advice. All models are experimental and have not been validated for live trading. Signals should be used as one input among many, not as standalone buy/sell recommendations.`,
  },
]

function Section({ title, icon, body }) {
  return (
    <div className="border border-[#1E2C3E] rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-xs font-semibold text-[#00E5B3]">{title}</h3>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  )
}

export default function MethodologyPanel() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">🔬</span>
        <h2 className="text-sm font-semibold text-slate-200">How It Works</h2>
        <span className="text-[10px] text-slate-600 ml-1">— models, signals, and data sources explained</span>
      </div>
      {SECTIONS.map(s => (
        <Section key={s.title} {...s} />
      ))}
    </div>
  )
}
