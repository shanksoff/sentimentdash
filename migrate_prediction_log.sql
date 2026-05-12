-- Migration: add prediction_log table
-- Run once on the production DB:
--   docker exec -i sentiment_db psql -U $POSTGRES_USER -d $POSTGRES_DB < migrate_prediction_log.sql

CREATE TABLE IF NOT EXISTS prediction_log (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(20)  NOT NULL,
    signal_date     DATE         NOT NULL,
    signal          VARCHAR(10)  NOT NULL,
    prob_up         NUMERIC(6,4) NOT NULL,
    horizon_days    SMALLINT     NOT NULL DEFAULT 5,
    outcome_date    DATE,
    outcome         SMALLINT,
    correct         BOOLEAN,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_prediction_log_ticker_date UNIQUE (ticker, signal_date)
);

CREATE INDEX IF NOT EXISTS idx_prediction_log_ticker      ON prediction_log(ticker);
CREATE INDEX IF NOT EXISTS idx_prediction_log_signal_date ON prediction_log(signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_log_outcome     ON prediction_log(outcome_date)
    WHERE outcome IS NULL;
