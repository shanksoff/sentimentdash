function ScoreBadge({ score }) {
  const cls =
    score >= 7 ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
    : score >= 4 ? 'bg-amber-900/60 text-amber-300 border border-amber-700'
    : 'bg-red-900/60 text-red-300 border border-red-700'
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg text-sm font-bold font-mono ${cls}`}>
      {score}
    </span>
  )
}

function ArticleCard({ article }) {
  const date = (article.published_at || article.created_at)?.slice(0, 10) ?? '—'
  const sentimentLabel =
    article.score >= 7 ? 'Bullish' : article.score >= 4 ? 'Neutral' : 'Bearish'
  const labelCls =
    article.score >= 7 ? 'text-emerald-400'
    : article.score >= 4 ? 'text-amber-400'
    : 'text-red-400'

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <ScoreBadge score={article.score} />

      <div className="flex-1 min-w-0">
        {/* headline */}
        <p className="text-sm font-medium text-slate-100 leading-snug">
          {article.headline}
        </p>

        {/* meta row */}
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
          <span>{date}</span>
          {article.source && <><span>·</span><span>{article.source}</span></>}
          <span>·</span>
          <span className={`font-semibold ${labelCls}`}>{sentimentLabel}</span>
        </p>

        {/* Gemini reasoning */}
        {article.summary && (
          <p className="text-xs text-slate-400 mt-1.5 italic leading-relaxed border-l-2 border-slate-700 pl-2">
            "{article.summary}"
          </p>
        )}
      </div>
    </div>
  )
}

export default function SentimentPanel({ articles, selectedDate, onClearDate }) {
  const display = selectedDate
    ? articles.filter(
        a => (a.published_at || a.created_at)?.slice(0, 10) === selectedDate
      )
    : articles

  return (
    <div className="card">
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
          News &amp; Sentiment Reasoning
        </h2>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          {selectedDate ? (
            <>
              <span>
                Showing {display.length} article{display.length !== 1 ? 's' : ''} on{' '}
                <span className="font-mono text-slate-300">{selectedDate}</span>
              </span>
              <button
                onClick={onClearDate}
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                × clear filter
              </button>
            </>
          ) : (
            <span>{articles.length} article{articles.length !== 1 ? 's' : ''} · click a chart dot to filter</span>
          )}
        </div>
      </div>

      {/* article list */}
      {display.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-8">
          {selectedDate
            ? `No articles on ${selectedDate}`
            : 'No sentiment data yet — the scheduler populates this daily.'}
        </p>
      ) : (
        <div>{display.map((a, i) => <ArticleCard key={i} article={a} />)}</div>
      )}
    </div>
  )
}
