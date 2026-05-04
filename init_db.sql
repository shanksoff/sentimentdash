-- ============================================================
--  Stock Sentiment & Analytics Dashboard — Database Schema
--  PostgreSQL 15
-- ============================================================

-- ------------------------------------------------------------
--  1. TICKERS
--     Stores each tracked ticker and its cached fundamentals.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickers (
    id                  SERIAL PRIMARY KEY,
    symbol              VARCHAR(20)  NOT NULL UNIQUE,
    company_name        VARCHAR(255),

    -- Key Metrics (cached from yfinance)
    week_52_high        NUMERIC(12, 4),
    week_52_low         NUMERIC(12, 4),
    roe                 NUMERIC(8, 4),   -- as decimal e.g. 0.1523 = 15.23%
    pe_ratio            NUMERIC(10, 4),
    price_to_book       NUMERIC(10, 4),
    price_to_sales      NUMERIC(10, 4),
    eps                 NUMERIC(10, 4),
    debt_to_equity      NUMERIC(10, 4),

    -- Dividend Data
    dividend_payout_ratio       NUMERIC(8, 4),
    dividend_per_share          NUMERIC(10, 4),
    last_dividend_date          DATE,
    dividend_5yr_growth         NUMERIC(8, 4),  -- as decimal

    -- Relative Performance (as decimals)
    perf_1m             NUMERIC(8, 4),
    perf_3m             NUMERIC(8, 4),
    perf_6m             NUMERIC(8, 4),
    perf_12m            NUMERIC(8, 4),

    -- Income Statement (5 years, stored as JSONB array)
    -- Structure: [{ year, total_revenue, total_operating_expense, ebit,
    --               ebitda, eps, net_income, net_profit_margin,
    --               debt_equity, roic, roa, roe }, ...]
    income_statement    JSONB,

    last_updated        TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
--  2. RSS_ARTICLES
--     News headlines ingested from Yahoo Finance RSS feeds.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rss_articles (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20)  NOT NULL REFERENCES tickers(symbol) ON DELETE CASCADE,
    headline        TEXT         NOT NULL,
    url             TEXT         NOT NULL UNIQUE,   -- deduplicate on URL
    source          VARCHAR(255),
    published_at    TIMESTAMPTZ,
    scored          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rss_articles_ticker     ON rss_articles(ticker);
CREATE INDEX IF NOT EXISTS idx_rss_articles_scored     ON rss_articles(scored);
CREATE INDEX IF NOT EXISTS idx_rss_articles_published  ON rss_articles(published_at DESC);

-- ------------------------------------------------------------
--  3. SENTIMENT_RESULTS
--     Gemini AI scores and summaries for each article.
--     One-to-one with rss_articles (one score per article).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sentiment_results (
    id              SERIAL PRIMARY KEY,
    article_id      INTEGER      NOT NULL REFERENCES rss_articles(id) ON DELETE CASCADE,
    ticker          VARCHAR(20)  NOT NULL,
    score           SMALLINT     NOT NULL CHECK (score BETWEEN 1 AND 10),
    summary         TEXT,
    model_used      VARCHAR(100) DEFAULT 'gemini-2.5-pro-preview',
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_ticker     ON sentiment_results(ticker);
CREATE INDEX IF NOT EXISTS idx_sentiment_article    ON sentiment_results(article_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_created    ON sentiment_results(created_at DESC);

-- ------------------------------------------------------------
--  4. PRICE_HISTORY
--     Daily OHLCV data per ticker (1 month rolling window).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_history (
    id          SERIAL PRIMARY KEY,
    ticker      VARCHAR(20)  NOT NULL,
    date        DATE         NOT NULL,
    open        NUMERIC(12, 4),
    high        NUMERIC(12, 4),
    low         NUMERIC(12, 4),
    close       NUMERIC(12, 4),
    volume      BIGINT,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_price_history_ticker_date UNIQUE (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_price_history_ticker  ON price_history(ticker);
CREATE INDEX IF NOT EXISTS idx_price_history_date    ON price_history(date DESC);

-- ------------------------------------------------------------
--  Confirmation
-- ------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE 'Schema initialised: tickers, rss_articles, sentiment_results, price_history';
END $$;
