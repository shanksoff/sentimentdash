"""
backfill.py
One-time script to fetch and score 30 days of news sentiment
for all tracked tickers.

Run once on the server:
    python backfill.py

Safe to re-run — INSERT uses ON CONFLICT DO NOTHING so no duplicates.
"""

import logging
import fetch_news                          # we'll monkey-patch LOOKBACK_DAYS
import fetch_news as _fn

from database import close_pool, get_conn, init_pool
from sentiment_engine import make_client, score_unscored

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Widen the fetch window to 30 days for this run ───────────────────────────
_fn.LOOKBACK_DAYS = 30

TRACKED_SYMBOLS = [
    "NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "GOOG", "AVGO", "META",
    "TSLA", "WMT", "BRK-B", "LLY", "JPM", "MU", "AMD", "XOM",
    "V", "INTC", "ORCL", "JNJ", "COST", "MA", "CAT", "BAC", "NFLX",
    "SPY",
]


def run():
    init_pool(minconn=1, maxconn=5)
    client = make_client()
    log.info("=== backfill started — 30-day window, %d symbols ===", len(TRACKED_SYMBOLS))

    total_fetched = 0
    total_scored  = 0

    try:
        for symbol in TRACKED_SYMBOLS:
            # 1. Fetch news (30-day window)
            with get_conn() as conn:
                try:
                    n = fetch_news.fetch_for_ticker(conn, symbol)
                    total_fetched += n
                    log.info("[%s] fetched %d articles", symbol, n)
                except Exception as exc:
                    log.error("[%s] fetch failed: %s", symbol, exc)

            # 2. Score all unscored articles for this ticker
            with get_conn() as conn:
                try:
                    scored = score_unscored(conn, client, batch_size=200, ticker=symbol)
                    total_scored += scored
                    log.info("[%s] scored %d articles", symbol, scored)
                except Exception as exc:
                    log.error("[%s] scoring failed: %s", symbol, exc)

        log.info("=== backfill complete — fetched %d, scored %d ===",
                 total_fetched, total_scored)
    finally:
        close_pool()


if __name__ == "__main__":
    run()
