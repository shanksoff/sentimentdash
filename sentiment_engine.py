"""
sentiment_engine.py
Scores unscored rss_articles with Gemini and writes results to sentiment_results.
Reads the Gemini API key from .env (GEMINI_API_KEY) or .secrets/secrets.toml.
"""

import os
import logging
import tomllib
from pathlib import Path

import psycopg2
import psycopg2.extras
from google import genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MODEL = "gemini-2.5-pro"
BATCH_SIZE = 20  # articles per run

PROMPT_TEMPLATE = """You are a financial news sentiment analyst.

Ticker: {ticker}
Headline: "{headline}"

Rate the sentiment of this headline on a scale from 1 to 10:
  1–3 = Clearly negative (bad earnings, lawsuit, scandal, downgrade)
  4–6 = Neutral or mixed
  7–10 = Clearly positive (beat expectations, new product, upgrade, partnership)

Respond with ONLY a JSON object in this exact format (no markdown, no extra text):
{{"score": <integer 1-10>, "summary": "<one sentence explanation under 20 words>"}}"""


def _load_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "")
    if key:
        return key
    secrets_path = Path(__file__).parent / ".secrets" / "secrets.toml"
    if secrets_path.exists():
        with open(secrets_path, "rb") as f:
            secrets = tomllib.load(f)
        key = secrets.get("gemini", {}).get("api_key", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not found in .env or .secrets/secrets.toml")
    return key


def get_db_conn():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        dbname=os.getenv("POSTGRES_DB"),
    )


def make_client() -> genai.Client:
    return genai.Client(api_key=_load_gemini_key())


@retry(
    retry=retry_if_exception_type(Exception),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _call_gemini(client: genai.Client, prompt: str) -> dict:
    import json
    response = client.models.generate_content(model=MODEL, contents=prompt)
    text = response.text.strip()
    # Strip accidental markdown code fences
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def score_unscored(conn, client: genai.Client, batch_size: int = BATCH_SIZE, ticker: str | None = None) -> int:
    if ticker:
        sql = """
            SELECT id, ticker, headline
            FROM rss_articles
            WHERE scored = FALSE AND ticker = %s
            ORDER BY published_at DESC NULLS LAST
            LIMIT %s
        """
        params = (ticker, batch_size)
    else:
        sql = """
            SELECT id, ticker, headline
            FROM rss_articles
            WHERE scored = FALSE
            ORDER BY published_at DESC NULLS LAST
            LIMIT %s
        """
        params = (batch_size,)

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        articles = cur.fetchall()

    if not articles:
        log.info("no unscored articles")
        return 0

    scored = 0
    for article in articles:
        article_id = article["id"]
        ticker_sym = article["ticker"]
        headline = article["headline"]

        try:
            prompt = PROMPT_TEMPLATE.format(ticker=ticker_sym, headline=headline)
            result = _call_gemini(client, prompt)

            score = int(result["score"])
            summary = str(result.get("summary", ""))

            if not (1 <= score <= 10):
                raise ValueError(f"score {score} out of range")

            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO sentiment_results (article_id, ticker, score, summary, model_used)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (article_id, ticker_sym, score, summary, MODEL),
                )
                cur.execute(
                    "UPDATE rss_articles SET scored = TRUE WHERE id = %s",
                    (article_id,),
                )
            conn.commit()
            scored += 1
            log.info("scored article %d [%s]: %d/10 — %s", article_id, ticker_sym, score, summary)

        except Exception as exc:
            log.error("failed to score article %d: %s", article_id, exc)
            conn.rollback()

    return scored


def run(batch_size: int = BATCH_SIZE):
    client = make_client()
    conn = get_db_conn()
    try:
        total = score_unscored(conn, client, batch_size)
        log.info("scoring complete — %d articles scored", total)
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    batch = int(sys.argv[1]) if len(sys.argv) > 1 else BATCH_SIZE
    run(batch)
