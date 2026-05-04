"""
database.py
Thread-safe psycopg2 connection pool for the FastAPI backend.
Call init_pool() once at startup (via FastAPI lifespan), then use
get_conn() as a context manager anywhere you need a DB connection.
"""

import os
from contextlib import contextmanager

from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

_pool: pool.ThreadedConnectionPool | None = None


def init_pool(minconn: int = 2, maxconn: int = 10) -> None:
    global _pool
    _pool = pool.ThreadedConnectionPool(
        minconn,
        maxconn,
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        dbname=os.getenv("POSTGRES_DB"),
    )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def get_conn():
    if _pool is None:
        raise RuntimeError("Connection pool not initialised — call init_pool() first.")
    conn = _pool.getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)
