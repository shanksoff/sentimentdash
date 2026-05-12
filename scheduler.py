"""
scheduler.py
Runs once at startup then daily at 02:00 UTC:
  - Fetch news for all tracked tickers (10-day window)
  - Score any unscored articles with Gemini
  - Prune articles and scores older than 30 days
"""

import time
import logging
import schedule

import psycopg2.extras

from database import close_pool, get_conn, init_pool
from fetch_market_data import upsert_price_history, upsert_ticker
from fetch_news import fetch_for_ticker
from sentiment_engine import make_client, score_unscored

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Top 25 S&P 500 companies by index weight + SPY benchmark
TRACKED_SYMBOLS = [
    "NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "GOOG", "AVGO", "META",
    "TSLA", "WMT", "BRK-B", "LLY", "JPM", "MU", "AMD", "XOM",
    "V", "INTC", "ORCL", "JNJ", "COST", "MA", "CAT", "BAC", "NFLX",
    "SPY",
]


def _seed_tickers():
    """Ensure all tracked symbols exist in the tickers table."""
    for symbol in TRACKED_SYMBOLS:
        with get_conn() as conn:
            try:
                upsert_ticker(conn, symbol)
                log.info("seeded ticker %s", symbol)
            except Exception as exc:
                log.error("seed failed for %s: %s", symbol, exc)


def resolve_prediction_outcomes():
    """
    For each pending prediction whose outcome_date has passed,
    look up actual prices and mark correct/incorrect.
    Hold signals are skipped (no directional bet).
    """
    from datetime import date as date_cls
    today = date_cls.today()

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, ticker, signal_date, signal, outcome_date
                FROM prediction_log
                WHERE outcome IS NULL
                  AND outcome_date <= %s
                """,
                (today,),
            )
            pending = [dict(r) for r in cur.fetchall()]

    log.info("resolving %d pending prediction(s)", len(pending))

    for row in pending:
        ticker = row["ticker"]
        row_id = row["id"]
        signal = row["signal"]
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Closest price on or before signal_date
                    cur.execute(
                        """
                        SELECT close FROM price_history
                        WHERE ticker = %s AND date <= %s
                        ORDER BY date DESC LIMIT 1
                        """,
                        (ticker, row["signal_date"]),
                    )
                    r0 = cur.fetchone()

                    # Closest price on or before outcome_date
                    cur.execute(
                        """
                        SELECT close FROM price_history
                        WHERE ticker = %s AND date <= %s
                        ORDER BY date DESC LIMIT 1
                        """,
                        (ticker, row["outcome_date"]),
                    )
                    r1 = cur.fetchone()

                if r0 is None or r1 is None:
                    log.warning("missing prices for prediction %d (%s)", row_id, ticker)
                    continue

                p0, p1 = float(r0[0]), float(r1[0])
                went_up = 1 if p1 > p0 else 0

                if signal == "Watch":
                    correct = went_up == 1
                elif signal == "Avoid":
                    correct = went_up == 0
                else:
                    correct = None  # Hold — no directional bet

                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE prediction_log SET outcome=%s, correct=%s WHERE id=%s",
                        (went_up, correct, row_id),
                    )
                conn.commit()
                log.info(
                    "resolved %d: %s %s → price %s (correct=%s)",
                    row_id, ticker, signal, "up" if went_up else "down", correct,
                )
        except Exception as exc:
            log.error("failed to resolve prediction %d: %s", row_id, exc)


def daily_run():
    log.info("=== daily run started ===")
    client = make_client()

    for symbol in TRACKED_SYMBOLS:
        # 1. Refresh price history
        with get_conn() as conn:
            try:
                upsert_price_history(conn, symbol)
                log.info("refreshed price history for %s", symbol)
            except Exception as exc:
                log.error("price refresh failed for %s: %s", symbol, exc)

        # 2. Fetch latest news
        with get_conn() as conn:
            try:
                n = fetch_for_ticker(conn, symbol)
                log.info("fetched %d articles for %s", n, symbol)
            except Exception as exc:
                log.error("fetch failed for %s: %s", symbol, exc)

        # 2. Score unscored articles
        with get_conn() as conn:
            try:
                scored = score_unscored(conn, client, batch_size=100, ticker=symbol)
                log.info("scored %d articles for %s", scored, symbol)
            except Exception as exc:
                log.error("scoring failed for %s: %s", symbol, exc)

    # 3. Prune data older than 30 days
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM sentiment_results
                WHERE article_id IN (
                    SELECT id FROM rss_articles
                    WHERE published_at < NOW() - INTERVAL '30 days'
                )
            """)
            deleted_sr = cur.rowcount
            cur.execute("""
                DELETE FROM rss_articles
                WHERE published_at < NOW() - INTERVAL '30 days'
            """)
            deleted_ra = cur.rowcount
        conn.commit()
        log.info("pruned %d sentiment results and %d articles older than 30 days",
                 deleted_sr, deleted_ra)

    # 4. Resolve pending prediction outcomes
    resolve_prediction_outcomes()

    log.info("=== daily run complete ===")


if __name__ == "__main__":
    init_pool(minconn=1, maxconn=5)
    try:
        _seed_tickers()
        daily_run()
        schedule.every().day.at("02:00").do(daily_run)
        log.info("scheduler armed — next run at 02:00 UTC daily")
        while True:
            schedule.run_pending()
            time.sleep(60)
    finally:
        close_pool()
