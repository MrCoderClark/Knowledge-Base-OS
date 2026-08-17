import psycopg

from .config import settings


def connect() -> psycopg.Connection:
    """A short-lived autocommit connection to the shared Neon Postgres."""
    return psycopg.connect(settings.database_url, autocommit=True)
