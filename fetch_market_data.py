"""
fetch_market_data.py
Fetches fundamentals and 1-month daily OHLCV from yfinance,
then upserts into the tickers and price_history tables.
"""

import os
import json
import logging
from datetime import date, timedelta

import math

import yfinance as yf
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def get_db_conn():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        dbname=os.getenv("POSTGRES_DB"),
    )


def _safe(info: dict, key: str, cast=None):
    val = info.get(key)
    if val is None:
        return None
    return cast(val) if cast else val


def build_income_statement(ticker_obj) -> list | None:
    """Return last 5 annual income-statement rows as a list of dicts."""
    try:
        fin = ticker_obj.financials  # columns = fiscal year end dates
        if fin is None or fin.empty:
            return None
        rows = []
        for col in fin.columns[:5]:
            year = col.year

            def g(row):
                try:
                    val = float(fin.loc[row, col])
                    return None if math.isnan(val) or math.isinf(val) else val
                except Exception:
                    return None
            total_revenue = g("Total Revenue")
            net_income = g("Net Income")
            eps = g("Diluted EPS") or g("Basic EPS")
            net_profit_margin = (
                round(net_income / total_revenue, 6)
                if total_revenue and net_income
                else None
            )
            rows.append({
                "year": year,
                "total_revenue": total_revenue,
                "total_operating_expense": g("Operating Expense") or g("Total Expenses"),
                "ebit": g("EBIT"),
                "ebitda": g("EBITDA"),
                "eps": eps,
                "net_income": net_income,
                "net_profit_margin": net_profit_margin,
                "debt_equity": None,
                "roic": None,
                "roa": None,
                "roe": None,
            })
        return rows
    except Exception as exc:
        log.warning("income_statement build failed: %s", exc)
        return None


def upsert_ticker(conn, symbol: str):
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}

    income_stmt = build_income_statement(ticker)

    row = {
        "symbol": symbol.upper(),
        "company_name": _safe(info, "longName"),
        "week_52_high": _safe(info, "fiftyTwoWeekHigh", float),
        "week_52_low": _safe(info, "fiftyTwoWeekLow", float),
        "roe": _safe(info, "returnOnEquity", float),
        "pe_ratio": _safe(info, "trailingPE", float),
        "price_to_book": _safe(info, "priceToBook", float),
        "price_to_sales": _safe(info, "priceToSalesTrailing12Months", float),
        "eps": _safe(info, "trailingEps", float),
        "debt_to_equity": _safe(info, "debtToEquity", float),
        "dividend_payout_ratio": _safe(info, "payoutRatio", float),
        "dividend_per_share": _safe(info, "dividendRate", float),
        "last_dividend_date": (
            date.fromtimestamp(info["lastDividendDate"])
            if info.get("lastDividendDate")
            else None
        ),
        "dividend_5yr_growth": _safe(info, "fiveYearAvgDividendYield", float),
        "income_statement": json.dumps(income_stmt) if income_stmt else None,
    }

    sql = """
        INSERT INTO tickers (
            symbol, company_name,
            week_52_high, week_52_low, roe, pe_ratio,
            price_to_book, price_to_sales, eps, debt_to_equity,
            dividend_payout_ratio, dividend_per_share, last_dividend_date, dividend_5yr_growth,
            income_statement, last_updated
        ) VALUES (
            %(symbol)s, %(company_name)s,
            %(week_52_high)s, %(week_52_low)s, %(roe)s, %(pe_ratio)s,
            %(price_to_book)s, %(price_to_sales)s, %(eps)s, %(debt_to_equity)s,
            %(dividend_payout_ratio)s, %(dividend_per_share)s, %(last_dividend_date)s, %(dividend_5yr_growth)s,
            %(income_statement)s, NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
            company_name          = EXCLUDED.company_name,
            week_52_high          = EXCLUDED.week_52_high,
            week_52_low           = EXCLUDED.week_52_low,
            roe                   = EXCLUDED.roe,
            pe_ratio              = EXCLUDED.pe_ratio,
            price_to_book         = EXCLUDED.price_to_book,
            price_to_sales        = EXCLUDED.price_to_sales,
            eps                   = EXCLUDED.eps,
            debt_to_equity        = EXCLUDED.debt_to_equity,
            dividend_payout_ratio = EXCLUDED.dividend_payout_ratio,
            dividend_per_share    = EXCLUDED.dividend_per_share,
            last_dividend_date    = EXCLUDED.last_dividend_date,
            dividend_5yr_growth   = EXCLUDED.dividend_5yr_growth,
            income_statement      = EXCLUDED.income_statement,
            last_updated          = NOW()
    """
    with conn.cursor() as cur:
        cur.execute(sql, row)
    conn.commit()
    log.info("upserted ticker %s", symbol)


def upsert_price_history(conn, symbol: str):
    ticker = yf.Ticker(symbol)
    end = date.today() + timedelta(days=1)  # yfinance end is exclusive
    start = end - timedelta(days=31)
    hist = ticker.history(start=start.isoformat(), end=end.isoformat(), interval="1d")

    if hist.empty:
        log.warning("no price history for %s", symbol)
        return

    rows = []
    for ts, row in hist.iterrows():
        rows.append({
            "ticker": symbol.upper(),
            "date": ts.date(),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"]),
        })

    sql = """
        INSERT INTO price_history (ticker, date, open, high, low, close, volume)
        VALUES (%(ticker)s, %(date)s, %(open)s, %(high)s, %(low)s, %(close)s, %(volume)s)
        ON CONFLICT (ticker, date) DO UPDATE SET
            open   = EXCLUDED.open,
            high   = EXCLUDED.high,
            low    = EXCLUDED.low,
            close  = EXCLUDED.close,
            volume = EXCLUDED.volume
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, rows)
    conn.commit()
    log.info("upserted %d price rows for %s", len(rows), symbol)


def run(symbols: list[str]):
    conn = get_db_conn()
    try:
        for sym in symbols:
            try:
                upsert_ticker(conn, sym)
                upsert_price_history(conn, sym)
            except Exception as exc:
                log.error("failed to process %s: %s", sym, exc)
                conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    tickers = sys.argv[1:] if len(sys.argv) > 1 else ["AAPL", "MSFT", "GOOGL"]
    run(tickers)
