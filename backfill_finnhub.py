"""
backfill_finnhub.py
One-time script: fetches up to 2 Finnhub news articles per ticker per day
for the last 30 days, inserts them into rss_articles, then scores with the
existing sentiment pipeline.

Requirements
------------
- FINNHUB_API_KEY in .env  (free key from finnhub.io)
- Run from the sentimentdash project root on the server

Usage
-----
    python backfill_finnhub.py

Safe to re-run — article insert uses ON CONFLICT DO NOTHING on URL.
"""

import logging
import os
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

import psycopg2.extras
import requests
from dotenv import load_dotenv

from database import close_pool, get_conn, init_pool
from sentiment_engine import make_client, score_unscored

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
FINNHUB_NEWS_URL = "https://finnhub.io/api/v1/company-news"

ARTICLES_PER_DAY = 2
LOOKBACK_DAYS = 30

TRACKED_SYMBOLS = [
    "SPY",
    "NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "GOOG", "AVGO", "META",
    "TSLA", "WMT", "BRK-B", "LLY", "JPM", "MU", "AMD", "XOM",
    "V", "INTC", "ORCL", "JNJ", "COST", "MA", "CAT", "BAC", "NFLX",
]


# ── Finnhub fetch ─────────────────────────────────────────────────────────────

def _fetch_finnhub(symbol: str, from_date: str, to_date: str) -> list[dict]:
    resp = requests.get(
        FINNHUB_NEWS_URL,
        params={"symbol": symbol, "from": from_date, "to": to_date, "token": FINNHUB_API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json() or []


def _top_per_day(articles: list[dict], per_day: int) -> list[dict]:
    """Group by calendar day (UTC), keep the first `per_day` per group."""
    by_day: dict[str, list[dict]] = defaultdict(list)
    for art in articles:
        ts = art.get("datetime")
        if not ts:
            continue
        day = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
        by_day[day].append(art)

    selected = []
    for day_arts in by_day.values():
        selected.extend(day_arts[:per_day])
    return selected


# ── DB insert ─────────────────────────────────────────────────────────────────

def _insert_articles(conn, symbol: str, articles: list[dict]) -> int:
    rows = []
    for art in articles:
        url = (art.get("url") or "").strip()
        headline = (art.get("headline") or "").strip()
        if not url or not headline:
            continue
        ts = art.get("datetime")
        published_at = (
            datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None
        )
        rows.append({
            "ticker":       symbol,
            "headline":     headline,
            "url":          url,
            "source":       art.get("source") or "Finnhub",
            "published_at": published_at,
        })

    if not rows:
        return 0

    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO rss_articles (ticker, headline, url, source, published_at)
            VALUES (%(ticker)s, %(headline)s, %(url)s, %(source)s, %(published_at)s)
            ON CONFLICT (url) DO NOTHING
            """,
            rows,
        )
    conn.commit()
    return len(rows)


# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    if not FINNHUB_API_KEY:
        raise RuntimeError("FINNHUB_API_KEY not set in .env")

    init_pool(minconn=1, maxconn=5)
    client = make_client()

    today = date.today()
    from_date = (today - timedelta(days=LOOKBACK_DAYS)).isoformat()
    to_date = today.isoformat()

    log.info(
        "=== Finnhub backfill: %s → %s | %d symbols | max %d articles/day ===",
        from_date, to_date, len(TRACKED_SYMBOLS), ARTICLES_PER_DAY,
    )

    total_inserted = 0
    total_scored = 0

    try:
        for i, symbol in enumerate(TRACKED_SYMBOLS):
            if i > 0:
                time.sleep(1)  # stay within free-tier 60 req/min

            # ── Fetch ──────────────────────────────────────────────────────
            try:
                raw = _fetch_finnhub(symbol, from_date, to_date)
                selected = _top_per_day(raw, ARTICLES_PER_DAY)
                log.info("[%s] %d total → %d selected (top %d/day)",
                         symbol, len(raw), len(selected), ARTICLES_PER_DAY)
            except Exception as exc:
                log.error("[%s] fetch failed: %s", symbol, exc)
                continue

            # ── Insert ─────────────────────────────────────────────────────
            try:
                with get_conn() as conn:
                    n = _insert_articles(conn, symbol, selected)
                total_inserted += n
                log.info("[%s] inserted %d new articles", symbol, n)
            except Exception as exc:
                log.error("[%s] insert failed: %s", symbol, exc)
                continue

            # ── Score ──────────────────────────────────────────────────────
            try:
                with get_conn() as conn:
                    scored = score_unscored(conn, client, batch_size=200, ticker=symbol)
                total_scored += scored
                log.info("[%s] scored %d articles", symbol, scored)
            except Exception as exc:
                log.error("[%s] scoring failed: %s", symbol, exc)

        log.info(
            "=== backfill complete — inserted %d articles, scored %d ===",
            total_inserted, total_scored,
        )
    finally:
        close_pool()


if __name__ == "__main__":
    run()
