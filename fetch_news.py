"""
fetch_news.py
Fetches headlines from Google News RSS (10-day window) + Yahoo Finance RSS
for each tracked ticker and inserts new articles into rss_articles.
Deduplicates on URL.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

import feedparser
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

YAHOO_RSS = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
GOOGLE_RSS = "https://news.google.com/rss/search?q={symbol}+stock&hl=en-US&gl=US&ceid=US:en"
LOOKBACK_DAYS = 10


def get_db_conn():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        dbname=os.getenv("POSTGRES_DB"),
    )


def _parse_pub_date(entry) -> str | None:
    raw = entry.get("published") or entry.get("updated")
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def _fetch_feed(url: str, symbol: str, cutoff: datetime) -> list[dict]:
    feed = feedparser.parse(url)
    if feed.bozo and not feed.entries:
        log.warning("RSS parse error for %s from %s: %s", symbol, url, feed.bozo_exception)
        return []

    rows = []
    for entry in feed.entries:
        headline = entry.get("title", "").strip()
        article_url = entry.get("link", "").strip()
        source = entry.get("source", {}).get("title") or feed.feed.get("title")
        pub_at = _parse_pub_date(entry)

        if not headline or not article_url:
            continue

        # Filter to lookback window
        if pub_at:
            try:
                dt = datetime.fromisoformat(pub_at)
                if dt < cutoff:
                    continue
            except Exception:
                pass

        rows.append({
            "ticker": symbol.upper(),
            "headline": headline,
            "url": article_url,
            "source": source,
            "published_at": pub_at,
        })
    return rows


def fetch_for_ticker(conn, symbol: str) -> int:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    sym = symbol.upper()

    rows: dict[str, dict] = {}  # dedupe by URL

    # Primary: Google News (broader date coverage)
    for row in _fetch_feed(GOOGLE_RSS.format(symbol=sym), sym, cutoff):
        rows[row["url"]] = row

    # Supplement: Yahoo Finance RSS (ticker-specific, may have unique articles)
    for row in _fetch_feed(YAHOO_RSS.format(symbol=sym), sym, cutoff):
        rows.setdefault(row["url"], row)

    if not rows:
        return 0

    sql = """
        INSERT INTO rss_articles (ticker, headline, url, source, published_at)
        VALUES (%(ticker)s, %(headline)s, %(url)s, %(source)s, %(published_at)s)
        ON CONFLICT (url) DO NOTHING
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, list(rows.values()))
    conn.commit()
    log.info("fetched %d articles for %s", len(rows), sym)
    return len(rows)


def run(symbols: list[str]):
    conn = get_db_conn()
    try:
        for sym in symbols:
            try:
                fetch_for_ticker(conn, sym)
            except Exception as exc:
                log.error("failed to fetch news for %s: %s", sym, exc)
                conn.rollback()
    finally:
        conn.close()


def get_tracked_symbols(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT symbol FROM tickers ORDER BY symbol")
        return [row[0] for row in cur.fetchall()]


if __name__ == "__main__":
    import sys
    conn = get_db_conn()
    if len(sys.argv) > 1:
        symbols = sys.argv[1:]
    else:
        symbols = get_tracked_symbols(conn)
    conn.close()
    run(symbols)
