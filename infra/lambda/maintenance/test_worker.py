"""Unit tests and opt-in PostgreSQL integration tests using temporary tables."""

import json
import os
import unittest
from unittest.mock import MagicMock, patch

import psycopg2

import maintenance


class HandlerTests(unittest.TestCase):
    def test_handler_commits_counts_and_closes(self):
        conn = MagicMock()
        cur = conn.cursor.return_value.__enter__.return_value
        type(cur).rowcount = unittest.mock.PropertyMock(side_effect=[2, 3, 4])
        with patch.object(maintenance, "_connect", return_value=conn):
            result = maintenance.handler({}, None)
        self.assertEqual(result, {"statusCode": 200, "body": {
            "expired_orders": 2, "reaped_seats": 3, "deactivated_vouchers": 4}})
        self.assertEqual([c.args[0] for c in cur.execute.call_args_list], [
            maintenance.SQL_EXPIRE_ORDERS, maintenance.SQL_REAP_SEATS,
            maintenance.SQL_DEACTIVATE_VOUCHERS])
        self.assertEqual(conn.__exit__.call_args.args, (None, None, None))
        conn.close.assert_called_once()

    def test_sql_error_propagates_and_closes(self):
        conn = MagicMock()
        cur = conn.cursor.return_value.__enter__.return_value
        cur.execute.side_effect = [None, RuntimeError("database failure")]
        with patch.object(maintenance, "_connect", return_value=conn):
            with self.assertRaisesRegex(RuntimeError, "database failure"):
                maintenance.handler({}, None)
        self.assertIs(conn.__exit__.call_args.args[0], RuntimeError)
        self.assertEqual(cur.execute.call_count, 2)
        conn.close.assert_called_once()

    def test_connection_uses_current_secret_and_tls(self):
        secrets = MagicMock()
        secrets.get_secret_value.return_value = {"SecretString": json.dumps({
            "username": "worker", "password": "rotated", "dbname": "ticketrush"})}
        with patch.object(maintenance, "_secrets_client", secrets), \
                patch.object(maintenance, "DB_SECRET_NAME", "demo/db"), \
                patch.object(maintenance, "DB_HOST", "private-db"), \
                patch.object(maintenance.psycopg2, "connect") as connect:
            maintenance._connect()
            maintenance._connect()
        self.assertEqual(secrets.get_secret_value.call_count, 2)
        secrets.get_secret_value.assert_called_with(SecretId="demo/db")
        self.assertEqual(connect.call_args.kwargs["sslmode"], "require")
        self.assertEqual(connect.call_args.kwargs["password"], "rotated")
        self.assertIn("statement_timeout=5000", connect.call_args.kwargs["options"])


@unittest.skipUnless(os.environ.get("MAINTENANCE_TEST_DSN"), "Set MAINTENANCE_TEST_DSN for PostgreSQL tests")
class PostgreSQLTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg2.connect(os.environ["MAINTENANCE_TEST_DSN"])
        self.addCleanup(self.conn.close)
        with self.conn:
            with self.conn.cursor() as cur:
                # Session-local tables shadow real application tables.
                cur.execute("""
                    CREATE TEMP TABLE orders (id int PRIMARY KEY, status text, expires_at timestamp);
                    CREATE TEMP TABLE seats (id int PRIMARY KEY, status text, locked_at timestamp, locked_by text);
                    CREATE TEMP TABLE vouchers (id int PRIMARY KEY, active boolean, end_date timestamp,
                        used_quantity int, total_quantity int);
                """)

    def test_boundaries_and_idempotency(self):
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO orders VALUES
                    (1,'PENDING',NOW()-INTERVAL '1 hour'), (2,'PENDING',NOW()+INTERVAL '1 hour'),
                    (3,'PAID',NOW()-INTERVAL '1 hour'), (4,'PENDING',NULL), (5,'PENDING',NOW());
                INSERT INTO seats VALUES
                    (1,'LOCKED',NOW()-INTERVAL '16 minutes','u'),
                    (2,'LOCKED',NOW()-INTERVAL '10 minutes','u'),
                    (3,'SOLD',NOW()-INTERVAL '1 hour','u'),
                    (4,'LOCKED',NULL,'u'), (5,'LOCKED',NOW()-INTERVAL '15 minutes','u');
                INSERT INTO vouchers VALUES
                    (1,true,NOW()-INTERVAL '1 hour',0,10),
                    (2,true,NOW()+INTERVAL '1 hour',10,10),
                    (3,true,NOW()+INTERVAL '1 hour',0,10),
                    (4,false,NOW()-INTERVAL '1 hour',0,10),
                    (5,true,NULL,0,10), (6,true,NOW(),0,10), (7,true,NULL,11,10);
            """)
        self.assertEqual(maintenance.run_jobs(self.conn), {
            "expired_orders": 1, "reaped_seats": 1, "deactivated_vouchers": 3})
        with self.conn.cursor() as cur:
            cur.execute("SELECT status, locked_at, locked_by FROM seats WHERE id=1")
            self.assertEqual(cur.fetchone(), ("AVAILABLE", None, None))
            # Move strict-boundary fixtures forward before a new transaction's NOW().
            cur.execute("UPDATE orders SET expires_at=NOW()+INTERVAL '1 hour' WHERE id=5")
            cur.execute("UPDATE seats SET locked_at=NOW() WHERE id=5")
            cur.execute("UPDATE vouchers SET end_date=NOW()+INTERVAL '1 hour' WHERE id=6")
        self.assertEqual(maintenance.run_jobs(self.conn), {
            "expired_orders": 0, "reaped_seats": 0, "deactivated_vouchers": 0})

    def test_failure_rolls_back_all_jobs(self):
        with self.conn:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO orders VALUES (1,'PENDING',NOW()-INTERVAL '1 hour');
                    INSERT INTO seats VALUES (1,'LOCKED',NOW()-INTERVAL '1 hour','u');
                    INSERT INTO vouchers VALUES (1,true,NOW()-INTERVAL '1 hour',0,10);
                    ALTER TABLE vouchers ADD CHECK (active = true);
                """)
        with self.assertRaises(psycopg2.errors.CheckViolation):
            maintenance.run_jobs(self.conn)
        with self.conn.cursor() as cur:
            cur.execute("SELECT status FROM orders WHERE id=1")
            self.assertEqual(cur.fetchone()[0], "PENDING")
            cur.execute("SELECT status, locked_by FROM seats WHERE id=1")
            self.assertEqual(cur.fetchone(), ("LOCKED", "u"))


if __name__ == "__main__":
    unittest.main()
