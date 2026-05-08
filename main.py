"""
main.py
FastAPI backend for the Stock Sentiment & Analytics Dashboard.

Endpoints
---------
GET /api/price/{ticker}            3-month OHLCV daily data
GET /api/sentiment/{ticker}        Last 30 days of scored articles
GET /api/fundamentals/{ticker}     All key metrics + dividend data
GET /api/income-statement/{ticker} 5-year income statement table
GET /api/performance/{ticker}      Relative perf (1M / 3M / 6M / 12M)
GET /api/forecast/{ticker}         Auto-ARIMA 7-day price forecast
GET /api/regression/{ticker}       Sentiment → return regression stats
GET /api/prediction/{ticker}       Random Forest Watch/Hold/Avoid signal
GET /api/analysis/{ticker}         Gemini AI analyst briefing (1-hr cache)

Sentiment data is populated by scheduler.py (runs daily).
When a ticker has no scored articles yet, get_sentiment fires a one-time
background bootstrap (fetch + score) so data appears within ~60 seconds.
"""

import logging
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import psycopg2.extras
import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from analysis_engine import generate_analysis
from analytics import arima_forecast, binary_prediction, sentiment_return_regression
from database import close_pool, get_conn, init_pool
from fetch_market_data import upsert_price_history, upsert_ticker
from fetch_news import fetch_for_ticker
from sentiment_engine import make_client, score_unscored

log = logging.getLogger("uvicorn.error")

# Tickers currently being bootstrapped in the background
_bootstrap_lock = threading.Lock()
_bootstrapping: set[str] = set()

# In-memory cache for AI analysis results  { symbol: {"data": dict, "ts": datetime} }
_analysis_cache: dict[str, dict] = {}
_ANALYSIS_TTL_SECONDS = 3600  # regenerate after 1 hour


def _bootstrap_sentiment(symbol: str) -> None:
    """Fetch news + score for a ticker with no sentiment data yet. Runs in a thread."""
    try:
        client = make_client()
        with get_conn() as conn:
            fetched = fetch_for_ticker(conn, symbol)
            log.info("bootstrap: fetched %d articles for %s", fetched, symbol)
        with get_conn() as conn:
            scored = score_unscored(conn, client, batch_size=100, ticker=symbol)
            log.info("bootstrap: scored %d articles for %s", scored, symbol)
    except Exception as exc:
        log.error("bootstrap failed for %s: %s", symbol, exc)
    finally:
        with _bootstrap_lock:
            _bootstrapping.discard(symbol)


# ── Lifespan ────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool(minconn=2, maxconn=10)
    log.info("DB connection pool ready.")
    yield
    close_pool()
    log.info("DB connection pool closed.")


# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(title="Stock Sentiment API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:80",
        "https://sentimentdash.shanksoff.com",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _dec_to_float(v):
    return float(v) if isinstance(v, Decimal) else v


def _sanitise_row(row: dict) -> dict:
    return {k: _dec_to_float(v) for k, v in row.items()}


def _query_ticker(conn, symbol: str) -> dict | None:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM tickers WHERE symbol = %s", (symbol,))
        row = cur.fetchone()
    return _sanitise_row(dict(row)) if row else None


def _compute_performance(symbol: str) -> dict:
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period="1y")

    def trailing_return(n_trading_days: int) -> float | None:
        if len(hist) < n_trading_days:
            return None
        past = float(hist["Close"].iloc[-n_trading_days])
        latest = float(hist["Close"].iloc[-1])
        return round((latest - past) / past, 6) if past else None

    return {
        "perf_1m": trailing_return(21),
        "perf_3m": trailing_return(63),
        "perf_6m": trailing_return(126),
        "perf_12m": trailing_return(250),
    }


def _cache_performance(symbol: str, perfs: dict) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tickers
                SET perf_1m = %s, perf_3m = %s, perf_6m = %s, perf_12m = %s
                WHERE symbol = %s
                """,
                (
                    perfs["perf_1m"],
                    perfs["perf_3m"],
                    perfs["perf_6m"],
                    perfs["perf_12m"],
                    symbol,
                ),
            )
        conn.commit()


# ── Endpoints ────────────────────────────────────────────────────────────────


def _fetch_price_rows(conn, symbol: str) -> list:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT date, open, high, low, close, volume "
            "FROM price_history WHERE ticker = %s ORDER BY date ASC",
            (symbol,),
        )
        return cur.fetchall()


@app.get("/api/price/{ticker}")
def get_price(ticker: str) -> list[dict]:
    """3-month OHLCV daily data. Refreshes if latest row is older than 1 day."""
    symbol = ticker.upper()
    with get_conn() as conn:
        rows = _fetch_price_rows(conn, symbol)
        stale = not rows or str(rows[-1]["date"]) < str(
            date.today() - timedelta(days=1)
        )
        if stale:
            try:
                upsert_price_history(conn, symbol)
                rows = _fetch_price_rows(conn, symbol)
            except Exception as exc:
                log.warning("live price fetch failed for %s: %s", symbol, exc)
    return [_sanitise_row(dict(r)) for r in rows]


@app.get("/api/sentiment/{ticker}")
def get_sentiment(ticker: str) -> list[dict]:
    """
    Scored articles from the last 30 days, most recent first.
    If no data exists yet, fires a one-time background bootstrap (fetch + score).
    """
    symbol = ticker.upper()
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT sr.score,
                       sr.summary,
                       sr.created_at,
                       ra.headline,
                       ra.published_at,
                       ra.source
                FROM sentiment_results sr
                JOIN rss_articles ra ON ra.id = sr.article_id
                WHERE sr.ticker = %s
                  AND ra.published_at >= NOW() - INTERVAL '30 days'
                ORDER BY ra.published_at DESC NULLS LAST
                LIMIT 200
                """,
                (symbol,),
            )
            rows = [dict(r) for r in cur.fetchall()]

    if not rows:
        with _bootstrap_lock:
            if symbol not in _bootstrapping:
                _bootstrapping.add(symbol)
                threading.Thread(
                    target=_bootstrap_sentiment, args=(symbol,), daemon=True
                ).start()
                log.info("bootstrap triggered for %s", symbol)

    return rows


@app.get("/api/fundamentals/{ticker}")
def get_fundamentals(ticker: str) -> dict:
    """Key metrics + dividend data. Triggers live yfinance fetch if not cached."""
    symbol = ticker.upper()
    with get_conn() as conn:
        row = _query_ticker(conn, symbol)
        if row is None:
            try:
                upsert_ticker(conn, symbol)
                row = _query_ticker(conn, symbol)
            except Exception as exc:
                log.warning("live yfinance fetch failed for %s: %s", symbol, exc)

    if row is None:
        raise HTTPException(status_code=404, detail=f"Ticker '{symbol}' not found.")

    row.pop("income_statement", None)
    return row


@app.get("/api/income-statement/{ticker}")
def get_income_statement(ticker: str) -> list[dict]:
    """5-year annual income statement."""
    symbol = ticker.upper()
    with get_conn() as conn:
        row = _query_ticker(conn, symbol)
        if row is None or row.get("income_statement") is None:
            try:
                upsert_ticker(conn, symbol)
                row = _query_ticker(conn, symbol)
            except Exception as exc:
                log.warning("live yfinance fetch failed for %s: %s", symbol, exc)

    if row is None:
        raise HTTPException(status_code=404, detail=f"Ticker '{symbol}' not found.")

    income = row.get("income_statement") or []
    if isinstance(income, str):
        import json

        income = json.loads(income)
    return income


@app.get("/api/performance/{ticker}")
def get_performance(ticker: str) -> dict:
    """Relative performance: 1M / 3M / 6M / 12M."""
    symbol = ticker.upper()

    with get_conn() as conn:
        row = _query_ticker(conn, symbol)
        if row is None:
            try:
                upsert_ticker(conn, symbol)
                row = _query_ticker(conn, symbol)
            except Exception as exc:
                log.warning("live yfinance fetch failed for %s: %s", symbol, exc)

    if row is None:
        raise HTTPException(status_code=404, detail=f"Ticker '{symbol}' not found.")

    result = {
        "perf_1m": row.get("perf_1m"),
        "perf_3m": row.get("perf_3m"),
        "perf_6m": row.get("perf_6m"),
        "perf_12m": row.get("perf_12m"),
    }

    if any(v is None for v in result.values()):
        try:
            perfs = _compute_performance(symbol)
            _cache_performance(symbol, perfs)
            result = perfs
        except Exception as exc:
            log.warning("performance computation failed for %s: %s", symbol, exc)

    return result


# ── Analytics helpers ────────────────────────────────────────────────────────


def _fetch_sentiment_rows(conn, symbol: str) -> list:
    """Minimal sentiment query used by analytics endpoints (score + date only)."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT sr.score, ra.published_at
            FROM sentiment_results sr
            JOIN rss_articles ra ON ra.id = sr.article_id
            WHERE sr.ticker = %s
              AND ra.published_at >= NOW() - INTERVAL '30 days'
            ORDER BY ra.published_at ASC
            """,
            (symbol,),
        )
        return [dict(r) for r in cur.fetchall()]


@app.get("/api/regression/{ticker}")
def get_regression(ticker: str) -> dict:
    """Sentiment[t] → next-day log return[t+1] regression stats + scatter data."""
    symbol = ticker.upper()
    with get_conn() as conn:
        price_rows = _fetch_price_rows(conn, symbol)
        sent_rows = _fetch_sentiment_rows(conn, symbol)

    if not price_rows:
        raise HTTPException(status_code=404, detail=f"No price data for '{symbol}'.")

    return sentiment_return_regression(price_rows, sent_rows)


@app.get("/api/forecast/{ticker}")
def get_forecast(ticker: str) -> dict:
    """Auto-ARIMA 7-day price forecast with 95 % confidence interval."""
    symbol = ticker.upper()
    with get_conn() as conn:
        price_rows = _fetch_price_rows(conn, symbol)

    if len(price_rows) < 10:
        raise HTTPException(
            status_code=422,
            detail=f"Need at least 10 price observations for '{symbol}'.",
        )

    try:
        return arima_forecast(price_rows, horizon=7)
    except Exception as exc:
        log.error("ARIMA forecast failed for %s: %s", symbol, exc)
        raise HTTPException(status_code=500, detail="Forecast computation failed.")


@app.get("/api/prediction/{ticker}")
def get_prediction(ticker: str) -> dict:
    """Random Forest 5-day up/down prediction → Watch / Hold / Avoid signal."""
    symbol = ticker.upper()
    with get_conn() as conn:
        price_rows = _fetch_price_rows(conn, symbol)
        sent_rows = _fetch_sentiment_rows(conn, symbol)

    if len(price_rows) < 20:
        raise HTTPException(
            status_code=422,
            detail=f"Need at least 20 price observations for '{symbol}'.",
        )

    try:
        return binary_prediction(price_rows, sent_rows)
    except Exception as exc:
        log.error("Prediction failed for %s: %s", symbol, exc)
        raise HTTPException(status_code=500, detail="Prediction computation failed.")


@app.get("/api/analysis/{ticker}")
def get_analysis(ticker: str) -> dict:
    """Gemini AI analyst briefing combining price, sentiment, forecast and prediction."""
    symbol = ticker.upper()

    # Serve from cache if fresh
    cached = _analysis_cache.get(symbol)
    if cached:
        age = (datetime.now(timezone.utc) - cached["ts"]).total_seconds()
        if age < _ANALYSIS_TTL_SECONDS:
            return cached["data"]

    # Gather all inputs in parallel (best-effort — missing data is handled gracefully)
    with get_conn() as conn:
        price_rows = _fetch_price_rows(conn, symbol)
        sent_rows = _fetch_sentiment_rows(conn, symbol)

    forecast_data = None
    prediction_data = None
    company_name = None

    try:
        forecast_data = arima_forecast(price_rows, horizon=7) if len(price_rows) >= 10 else None
    except Exception:
        pass

    try:
        prediction_data = binary_prediction(price_rows, sent_rows) if len(price_rows) >= 20 else None
    except Exception:
        pass

    try:
        with get_conn() as conn:
            row = _query_ticker(conn, symbol)
        company_name = row.get("company_name") if row else None
    except Exception:
        pass

    if not price_rows and not sent_rows:
        raise HTTPException(status_code=404, detail=f"No data available for '{symbol}'.")

    try:
        client = make_client()
        result = generate_analysis(
            client=client,
            ticker=symbol,
            company_name=company_name,
            price_rows=price_rows,
            sentiment_rows=sent_rows,
            forecast=forecast_data,
            prediction=prediction_data,
        )
    except Exception as exc:
        log.error("AI analysis failed for %s: %s", symbol, exc)
        raise HTTPException(status_code=500, detail="AI analysis generation failed.")

    _analysis_cache[symbol] = {"data": result, "ts": datetime.now(timezone.utc)}
    return result


# ── Dev entry-point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
