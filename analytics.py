"""
analytics.py
Statistical analytics for the sentiment dashboard.

Functions
---------
sentiment_return_regression  Regress daily sentiment vs next-day log return
arima_forecast               Auto-ARIMA 7-day price forecast with 95 % CI
"""

import warnings
from datetime import date as date_cls, timedelta

import numpy as np
from scipy import stats


# ── Shared helper ────────────────────────────────────────────────────────────


def _daily_avg_sentiment(sentiment_rows: list[dict]) -> dict[str, float]:
    """Maps ISO date string → mean sentiment score for that day."""
    by_date: dict[str, list[float]] = {}
    for row in sentiment_rows:
        raw = row.get("published_at") or row.get("created_at")
        if not raw:
            continue
        d = str(raw)[:10]
        by_date.setdefault(d, []).append(float(row["score"]))
    return {d: sum(v) / len(v) for d, v in by_date.items()}


# ── Regression ───────────────────────────────────────────────────────────────


def sentiment_return_regression(
    price_rows: list[dict],
    sentiment_rows: list[dict],
) -> dict:
    """
    Regresses daily avg sentiment[t] against the next-day log return[t+1].

    Returns
    -------
    dict with keys: r, r_squared, p_value, slope, intercept, n, points
    Each point: { date, sentiment, next_return (%) }
    """
    sent = _daily_avg_sentiment(sentiment_rows)
    prices = sorted(price_rows, key=lambda r: str(r["date"]))

    points: list[dict] = []
    for i in range(len(prices) - 1):
        d = str(prices[i]["date"])[:10]
        if d not in sent:
            continue
        c0 = float(prices[i]["close"])
        c1 = float(prices[i + 1]["close"])
        if c0 <= 0:
            continue
        log_ret = np.log(c1 / c0)
        points.append(
            {
                "date":        d,
                "sentiment":   round(sent[d], 2),
                "next_return": round(float(log_ret) * 100, 4),  # express as %
            }
        )

    if len(points) < 5:
        return {"error": "insufficient_data", "n": len(points), "points": points}

    x = np.array([p["sentiment"]   for p in points])
    y = np.array([p["next_return"] for p in points])

    slope, intercept, r, p_value, stderr = stats.linregress(x, y)

    return {
        "r":         round(float(r), 4),
        "r_squared": round(float(r ** 2), 4),
        "p_value":   round(float(p_value), 4),
        "slope":     round(float(slope), 6),
        "intercept": round(float(intercept), 6),
        "stderr":    round(float(stderr), 6),
        "n":         len(points),
        "points":    points,
    }


# ── ARIMA forecast ────────────────────────────────────────────────────────────


def arima_forecast(price_rows: list[dict], horizon: int = 7) -> dict:
    """
    Fits an ARIMA model (order auto-selected via AIC) to the close price series
    and returns a `horizon`-day ahead point forecast with a 95 % CI.

    Returns
    -------
    dict with keys: model (order string), forecast (list of dicts)
    Each forecast dict: { date, yhat, yhat_lower, yhat_upper }
    """
    from pmdarima import auto_arima  # import here — heavy, lazy-load

    prices = sorted(price_rows, key=lambda r: str(r["date"]))
    closes = np.array([float(r["close"]) for r in prices], dtype=float)

    last_date = date_cls.fromisoformat(str(prices[-1]["date"])[:10])

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = auto_arima(
            closes,
            start_p=0, max_p=3,
            start_q=0, max_q=3,
            d=None,
            seasonal=False,
            information_criterion="aic",
            stepwise=True,
            suppress_warnings=True,
            error_action="ignore",
        )

    forecast_arr, ci = model.predict(
        n_periods=horizon,
        return_conf_int=True,
        alpha=0.05,
    )

    # Future trading dates (Mon–Fri only)
    future_dates: list[str] = []
    d = last_date
    while len(future_dates) < horizon:
        d += timedelta(days=1)
        if d.weekday() < 5:
            future_dates.append(str(d))

    return {
        "model": f"ARIMA{model.order}",
        "forecast": [
            {
                "date":       future_dates[i],
                "yhat":       round(float(forecast_arr[i]), 2),
                "yhat_lower": round(float(ci[i][0]), 2),
                "yhat_upper": round(float(ci[i][1]), 2),
            }
            for i in range(horizon)
        ],
    }
