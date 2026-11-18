"""
TicketRush Maintenance Worker — AWS Lambda handler.
Runs every 15 minutes via EventBridge to reconcile stale data.

Jobs:
  1. Expire PENDING orders past their expires_at.
  2. Delete draft tickets that belong to expired orders.
  3. Reap seats stuck in LOCKED for > 15 min (safety net for Redis TTL misses).
  4. Deactivate vouchers past end_date or fully used.
"""

import json
import logging
import os

import boto3
from botocore.config import Config
import psycopg2  # Supplied via Lambda layer or bundled in zip

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Environment variables (injected by Terraform) ──────────────────
DB_SECRET_NAME = os.environ.get("DB_SECRET_NAME")
DB_HOST = os.environ.get("DB_HOST")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
REGION = os.environ.get("AWS_REGION", "ap-southeast-1")

# ── SQL statements ─────────────────────────────────────────────────
SQL_EXPIRE_ORDERS = """
UPDATE orders
SET    status = 'EXPIRED'
WHERE  status = 'PENDING'
  AND  expires_at < NOW()
"""

SQL_DELETE_EXPIRED_TICKETS = """
DELETE FROM tickets t
USING  orders o
WHERE  t.order_id = o.id
  AND  o.status = 'EXPIRED'
"""

SQL_REAP_SEATS = """
UPDATE seats
SET    status    = 'AVAILABLE',
       locked_at = NULL,
       locked_by = NULL
WHERE  status    = 'LOCKED'
  AND  locked_at < NOW() - INTERVAL '15 minutes'
"""

SQL_DEACTIVATE_VOUCHERS = """
UPDATE vouchers
SET    active = false
WHERE  active = true
  AND  (end_date < NOW() OR used_quantity >= total_quantity)
"""

# ── Helpers ────────────────────────────────────────────────────────

_secrets_client = None


def _get_db_credentials() -> dict:
    """Retrieve PostgreSQL credentials from AWS Secrets Manager."""
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client(
            "secretsmanager", region_name=REGION,
            config=Config(connect_timeout=3, read_timeout=3,
                          retries={"total_max_attempts": 1}),
        )
    resp = _secrets_client.get_secret_value(SecretId=DB_SECRET_NAME)
    return json.loads(resp["SecretString"])


def _connect():
    """Return a psycopg2 connection to the TicketRush database."""
    if not DB_SECRET_NAME or not DB_HOST:
        raise ValueError("DB_SECRET_NAME and DB_HOST must be configured")
    creds = _get_db_credentials()
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=creds["dbname"],
        user=creds["username"],
        password=creds["password"],
        sslmode="require",
        connect_timeout=5,
        options="-c timezone=UTC -c statement_timeout=5000 -c lock_timeout=2000",
    )


# ── Handler ────────────────────────────────────────────────────────

def run_jobs(conn):
    """Run all three jobs atomically; caller owns and closes the connection."""
    results = {}
    with conn:
        with conn.cursor() as cur:
            for name, sql in (
                ("expired_orders", SQL_EXPIRE_ORDERS),
                ("deleted_expired_tickets", SQL_DELETE_EXPIRED_TICKETS),
                ("reaped_seats", SQL_REAP_SEATS),
                ("deactivated_vouchers", SQL_DEACTIVATE_VOUCHERS),
            ):
                cur.execute(sql)
                results[name] = cur.rowcount
    return results


def handler(event, context):
    """EventBridge entry point. Propagate failures so Lambda retries them."""
    conn = _connect()
    try:
        results = run_jobs(conn)
    finally:
        conn.close()

    logger.info("Maintenance completed: %s", json.dumps(results))
    return {"statusCode": 200, "body": results}
