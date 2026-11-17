"""Run the actual maintenance jobs against local PostgreSQL (commits changes).

Uses standard PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD variables.
"""

import json
import os

import psycopg2

from maintenance import run_jobs


def main():
    conn = psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ.get("PGDATABASE", "ticketrush"),
        user=os.environ.get("PGUSER", "postgres"),
        password=os.environ.get("PGPASSWORD", "postgres"),
        connect_timeout=5,
        options="-c timezone=UTC -c statement_timeout=5000 -c lock_timeout=2000",
    )
    try:
        print(json.dumps(run_jobs(conn)))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
