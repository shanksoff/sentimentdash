"""
analysis_engine.py
Generates an AI analyst briefing for a ticker using Gemini.

Takes structured price, sentiment, forecast and prediction data and
returns a short JSON briefing suitable for display in the dashboard.
"""

import json
import logging
from datetime import datetime

from google import genai
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

log = logging.getLogger("uvicorn.error")

MODEL = "gemini-3.1-flash-lite-preview"

PROMPT_TEMPLATE = """You are a concise financial analyst assistant. Analyse the data below for {ticker}{company_suffix} and produce a structured briefing.

## Price Action (last 5 trading days)
{price_table}

## Recent News Sentiment (last 7 scored articles, scale 1–10)
{sentiment_table}

## 7-Day ARIMA Price Forecast
Current close: ${last_close}
Point estimate in 7 days: ${yhat}  |  95% CI: ${yhat_lower} – ${yhat_upper}
Direction: {forecast_direction}

## ML Prediction Signal ({horizon_days}-day horizon)
Signal: {signal}  |  P(price up): {prob_pct}%
Top driver: {top_feature}

---
Respond with ONLY a valid JSON object (no markdown, no code fences) matching this exact schema:
{{
  "tone": "Bullish" | "Neutral" | "Bearish",
  "briefing": "<2-3 sentence professional summary covering price trend, sentiment tone, and what the models suggest>",
  "key_risk": "<1 sentence describing the main risk or uncertainty for this ticker right now>",
  "confidence": "Low" | "Medium" | "High"
}}"""


# ── Formatting helpers ───────────────────────────────────────────────────────


def _fmt_price_table(price_rows: list[dict]) -> str:
    rows = sorted(price_rows, key=lambda r: str(r["date"]))[-5:]
    lines = ["Date        Close    Change"]
    prev = None
    for r in rows:
        close = float(r["close"])
        chg = f"{((close - prev) / prev * 100):+.2f}%" if prev else "  —"
        lines.append(f"{str(r['date'])[:10]}  ${close:>8.2f}  {chg}")
        prev = close
    return "\n".join(lines)


def _fmt_sentiment_table(sentiment_rows: list[dict]) -> str:
    rows = sorted(
        sentiment_rows,
        key=lambda r: str(r.get("published_at") or r.get("created_at") or ""),
        reverse=True,
    )[:7]
    if not rows:
        return "No recent sentiment data available."
    lines = []
    for r in rows:
        score = r.get("score", "?")
        headline = (r.get("headline") or "")[:80]
        lines.append(f"[{score}/10] {headline}")
    return "\n".join(lines)


# ── Gemini call ───────────────────────────────────────────────────────────────


@retry(
    retry=retry_if_exception_type(Exception),
    wait=wait_exponential(multiplier=1, min=2, max=20),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _call_gemini(client: genai.Client, prompt: str) -> dict:
    response = client.models.generate_content(model=MODEL, contents=prompt)
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


# ── Public function ───────────────────────────────────────────────────────────


def generate_analysis(
    client: genai.Client,
    ticker: str,
    company_name: str | None,
    price_rows: list[dict],
    sentiment_rows: list[dict],
    forecast: dict | None,
    prediction: dict | None,
) -> dict:
    """
    Build a prompt from dashboard data and return a Gemini-generated briefing.

    Returns
    -------
    dict with keys: tone, briefing, key_risk, confidence, generated_at
    """
    price_table = _fmt_price_table(price_rows) if price_rows else "No price data."
    sentiment_table = _fmt_sentiment_table(sentiment_rows)

    # Forecast section
    if forecast and forecast.get("forecast"):
        fc = forecast["forecast"]
        last_close = float(price_rows[-1]["close"]) if price_rows else 0
        last_fc = fc[-1]
        yhat = last_fc["yhat"]
        yhat_lower = last_fc["yhat_lower"]
        yhat_upper = last_fc["yhat_upper"]
        pct_chg = (yhat - last_close) / last_close * 100 if last_close else 0
        forecast_direction = f"{'Up' if pct_chg >= 0 else 'Down'} {abs(pct_chg):.1f}% over 7 days"
    else:
        last_close = float(price_rows[-1]["close"]) if price_rows else 0
        yhat = yhat_lower = yhat_upper = last_close
        forecast_direction = "Unavailable"

    # Prediction section
    if prediction and not prediction.get("error"):
        signal = prediction.get("signal", "Hold")
        prob_pct = round(prediction.get("prob_up", 0.5) * 100, 1)
        horizon_days = prediction.get("horizon_days", 5)
        fi = prediction.get("feature_importance", [])
        top_feature = fi[0]["name"] if fi else "Unknown"
    else:
        signal = "Hold"
        prob_pct = 50.0
        horizon_days = 5
        top_feature = "Insufficient data"

    company_suffix = f" ({company_name})" if company_name else ""

    prompt = PROMPT_TEMPLATE.format(
        ticker=ticker,
        company_suffix=company_suffix,
        price_table=price_table,
        sentiment_table=sentiment_table,
        last_close=f"{last_close:.2f}",
        yhat=f"{yhat:.2f}",
        yhat_lower=f"{yhat_lower:.2f}",
        yhat_upper=f"{yhat_upper:.2f}",
        forecast_direction=forecast_direction,
        signal=signal,
        prob_pct=prob_pct,
        horizon_days=horizon_days,
        top_feature=top_feature,
    )

    log.info("generating AI analysis for %s", ticker)
    result = _call_gemini(client, prompt)

    # Validate / sanitise
    valid_tones = {"Bullish", "Neutral", "Bearish"}
    valid_conf = {"Low", "Medium", "High"}
    result["tone"] = result.get("tone", "Neutral") if result.get("tone") in valid_tones else "Neutral"
    result["confidence"] = result.get("confidence", "Low") if result.get("confidence") in valid_conf else "Low"
    result["briefing"] = str(result.get("briefing", ""))
    result["key_risk"] = str(result.get("key_risk", ""))
    result["generated_at"] = datetime.utcnow().isoformat() + "Z"

    return result
