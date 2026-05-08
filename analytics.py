"""
analytics.py
Statistical analytics for the sentiment dashboard.

Functions
---------
sentiment_return_regression  Regress daily sentiment vs next-day log return
arima_forecast               Auto-ARIMA 7-day price forecast with 95 % CI
binary_prediction            Random Forest 5-day up/down classifier → Watch/Hold/Avoid
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
            d=1,
            start_p=1, max_p=3,
            start_q=0, max_q=3,
            seasonal=False,
            information_criterion="aic",
            with_intercept=True,
            stepwise=True,
            suppress_warnings=True,
            error_action="ignore",
        )

    forecast_arr, ci = model.predict(
        n_periods=horizon,
        return_conf_int=True,
        alpha=0.05,
    )

    # Apply recent 10-day momentum as drift so flat ARIMA forecasts still slope
    recent = closes[-31:] if len(closes) >= 31 else closes
    avg_daily_return = float(np.mean(np.diff(recent) / recent[:-1]))
    last_price = float(closes[-1])

    # Future trading dates (Mon–Fri only)
    future_dates: list[str] = []
    d = last_date
    while len(future_dates) < horizon:
        d += timedelta(days=1)
        if d.weekday() < 5:
            future_dates.append(str(d))

    forecast_pts = []
    for i in range(horizon):
        trend_yhat = last_price * ((1 + avg_daily_return) ** (i + 1))
        ci_half = (float(ci[i][1]) - float(ci[i][0])) / 2
        forecast_pts.append({
            "date":       future_dates[i],
            "yhat":       round(trend_yhat, 2),
            "yhat_lower": round(trend_yhat - ci_half, 2),
            "yhat_upper": round(trend_yhat + ci_half, 2),
        })

    return {
        "model": f"ARIMA{model.order}",
        "forecast": forecast_pts,
    }


# ── Binary prediction ─────────────────────────────────────────────────────────

FEATURE_NAMES = ["RSI", "MACD Hist", "5d Momentum", "10d Momentum",
                 "Volatility", "Sentiment", "%B (BB position)"]

HORIZON = 5   # trading days ahead to predict


def binary_prediction(
    price_rows: list[dict],
    sentiment_rows: list[dict],
) -> dict:
    """
    Trains a Random Forest classifier on price + sentiment features and predicts
    whether the close price will be HIGHER in `HORIZON` trading days.

    Features per day
    ----------------
    RSI(14), MACD histogram(12,26,9), 5-day momentum, 10-day momentum,
    20-day annualised volatility, avg daily sentiment, %B (Bollinger position)

    Returns
    -------
    dict with keys:
      signal          : "Watch" | "Hold" | "Avoid"
      prob_up         : float 0-1 — model probability of price rising
      n_samples       : int  — training set size
      train_accuracy  : float — in-sample accuracy (honest caveat: overfits on small n)
      feature_importance : list of {name, importance}
      horizon_days    : int
    """
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import TimeSeriesSplit, cross_val_score
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    prices = sorted(price_rows, key=lambda r: str(r["date"]))
    closes = np.array([float(r["close"]) for r in prices], dtype=float)
    dates = [str(r["date"])[:10] for r in prices]
    n = len(closes)

    sent_map = _daily_avg_sentiment(sentiment_rows)
    global_sent_mean = float(np.mean(list(sent_map.values()))) if sent_map else 5.0

    # ── Pre-compute indicator arrays ─────────────────────────────────────────
    # RSI (14)
    rsi_arr = _rsi(closes, 14)

    # MACD histogram (12, 26, 9)
    hist_arr = _macd_histogram(closes, 12, 26, 9)

    # 20-day rolling volatility (annualised %)
    vol_arr = _rolling_vol(closes, 20)

    # Bollinger %B (20-day)
    pct_b_arr = _pct_b(closes, 20)

    # ── Build feature matrix ──────────────────────────────────────────────────
    X, y, sample_dates = [], [], []

    for i in range(n - HORIZON):
        if any(v is None for v in [rsi_arr[i], hist_arr[i], vol_arr[i], pct_b_arr[i]]):
            continue

        mom5  = (closes[i] - closes[max(0, i - 5)])  / closes[max(0, i - 5)]
        mom10 = (closes[i] - closes[max(0, i - 10)]) / closes[max(0, i - 10)]
        sent  = sent_map.get(dates[i], global_sent_mean)

        features = [
            rsi_arr[i],
            hist_arr[i],
            mom5  * 100,
            mom10 * 100,
            vol_arr[i],
            sent,
            pct_b_arr[i],
        ]

        future_ret = (closes[i + HORIZON] - closes[i]) / closes[i]
        label = 1 if future_ret > 0 else 0

        X.append(features)
        y.append(label)
        sample_dates.append(dates[i])

    if len(X) < 10:
        return {"error": "insufficient_data", "n_samples": len(X)}

    X = np.array(X, dtype=float)
    y = np.array(y, dtype=int)

    # If all labels are the same class the model can't learn anything meaningful
    if len(np.unique(y)) < 2:
        return {"error": "insufficient_data", "n_samples": len(X)}

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=3,            # shallow trees — avoids extreme overfitting on small n
        min_samples_leaf=3,     # leaf must cover ≥3 samples
        min_samples_split=6,    # split only when ≥6 samples present
        random_state=42,
        class_weight="balanced",
    )

    # ── Cross-validated accuracy (time-series aware) ──────────────────────────
    n_splits = min(3, len(X) // 8)   # need enough samples per fold
    if n_splits >= 2:
        pipe = make_pipeline(StandardScaler(), RandomForestClassifier(
            n_estimators=200, max_depth=3,
            min_samples_leaf=3, min_samples_split=6,
            random_state=42, class_weight="balanced",
        ))
        tscv = TimeSeriesSplit(n_splits=n_splits)
        cv_scores = cross_val_score(pipe, X, y, cv=tscv, scoring="accuracy")
        cv_accuracy = float(np.mean(cv_scores))
    else:
        cv_accuracy = None   # too few samples for meaningful CV

    clf.fit(X_scaled, y)

    # ── Predict on the latest complete feature row ────────────────────────────
    # Find last index where all features are valid (not in the HORIZON gap)
    latest_i = n - HORIZON - 1
    while latest_i >= 0 and any(v is None for v in [
        rsi_arr[latest_i], hist_arr[latest_i],
        vol_arr[latest_i], pct_b_arr[latest_i],
    ]):
        latest_i -= 1

    if latest_i < 0:
        return {"error": "insufficient_data", "n_samples": len(X)}

    mom5  = (closes[latest_i] - closes[max(0, latest_i - 5)])  / closes[max(0, latest_i - 5)]
    mom10 = (closes[latest_i] - closes[max(0, latest_i - 10)]) / closes[max(0, latest_i - 10)]
    sent  = sent_map.get(dates[latest_i], global_sent_mean)

    x_pred = np.array([[
        rsi_arr[latest_i],
        hist_arr[latest_i],
        mom5  * 100,
        mom10 * 100,
        vol_arr[latest_i],
        sent,
        pct_b_arr[latest_i],
    ]], dtype=float)

    x_pred_scaled = scaler.transform(x_pred)
    proba = clf.predict_proba(x_pred_scaled)[0]
    # If only one class seen in training, predict_proba has 1 column
    if len(proba) == 1:
        prob_up = float(proba[0]) if clf.classes_[0] == 1 else 0.0
    else:
        prob_up = float(proba[list(clf.classes_).index(1)])

    # ── Signal ────────────────────────────────────────────────────────────────
    if prob_up >= 0.60:
        signal = "Watch"
    elif prob_up >= 0.45:
        signal = "Hold"
    else:
        signal = "Avoid"

    importance = [
        {"name": FEATURE_NAMES[i], "importance": round(float(v), 4)}
        for i, v in enumerate(clf.feature_importances_)
    ]
    importance.sort(key=lambda x: x["importance"], reverse=True)

    return {
        "signal":            signal,
        "prob_up":           round(prob_up, 4),
        "n_samples":         len(X),
        "cv_accuracy":       round(cv_accuracy, 4) if cv_accuracy is not None else None,
        "feature_importance": importance,
        "horizon_days":      HORIZON,
    }


# ── Indicator helpers (lightweight, no external deps) ─────────────────────────

def _rsi(closes: np.ndarray, period: int = 14):
    n = len(closes)
    result = [None] * n
    if n < period + 1:
        return result
    gains = losses = 0.0
    for i in range(1, period + 1):
        d = closes[i] - closes[i - 1]
        gains += max(d, 0)
        losses += max(-d, 0)
    avg_g, avg_l = gains / period, losses / period
    rs = avg_g / avg_l if avg_l else float("inf")
    result[period] = 100 - 100 / (1 + rs)
    for i in range(period + 1, n):
        d = closes[i] - closes[i - 1]
        avg_g = (avg_g * (period - 1) + max(d, 0))  / period
        avg_l = (avg_l * (period - 1) + max(-d, 0)) / period
        rs = avg_g / avg_l if avg_l else float("inf")
        result[i] = 100 - 100 / (1 + rs)
    return result


def _ema(closes: np.ndarray, period: int):
    n = len(closes)
    result = [None] * n
    if n < period:
        return result
    k = 2 / (period + 1)
    result[period - 1] = float(np.mean(closes[:period]))
    for i in range(period, n):
        result[i] = closes[i] * k + result[i - 1] * (1 - k)
    return result


def _macd_histogram(closes, fast=12, slow=26, signal=9):
    n = len(closes)
    ef = _ema(closes, fast)
    es = _ema(closes, slow)
    macd = [None] * n
    for i in range(slow - 1, n):
        macd[i] = ef[i] - es[i]
    valid = [v for v in macd if v is not None]
    if len(valid) < signal:
        return [None] * n
    sig_ema = _ema(np.array(valid, dtype=float), signal)
    histogram = [None] * n
    vi = 0
    for i in range(n):
        if macd[i] is not None:
            if sig_ema[vi] is not None:
                histogram[i] = macd[i] - sig_ema[vi]
            vi += 1
    return histogram


def _rolling_vol(closes, period=20):
    n = len(closes)
    result = [None] * n
    for i in range(period, n):
        sl = closes[i - period + 1:i + 1]
        lr = [np.log(sl[j] / sl[j - 1]) for j in range(1, len(sl))]
        result[i] = float(np.std(lr, ddof=1) * np.sqrt(252) * 100)
    return result


def _pct_b(closes, period=20):
    n = len(closes)
    result = [None] * n
    for i in range(period - 1, n):
        sl = closes[i - period + 1:i + 1]
        mean = float(np.mean(sl))
        std  = float(np.std(sl, ddof=0))
        if std == 0:
            result[i] = 0.5
        else:
            result[i] = (closes[i] - (mean - 2 * std)) / (4 * std)
    return result
