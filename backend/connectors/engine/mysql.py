import MySQLdb
import MySQLdb.cursors
from .base import DatabaseConnector


class MySQLConnector(DatabaseConnector):

    def connect(self):
        self._connection = MySQLdb.connect(
            host=self.host,
            port=self.port,
            db=self.database,
            user=self.username,
            passwd=self.password,
        )

    def disconnect(self):
        if self._connection and self._connection.open:
            self._connection.close()
            self._connection = None

    def test_connection(self) -> bool:
        try:
            with self:
                cur = self._connection.cursor()
                cur.execute("SELECT 1")
                return True
        except Exception:
            return False

    def get_tables(self) -> list[str]:
        cur = self._connection.cursor()
        cur.execute("SHOW TABLES")
        return [row[0] for row in cur.fetchall()]

    def get_columns(self, table: str) -> list[dict]:
        cur = self._connection.cursor()
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (self.database, table))
        return [
            {"name": row[0], "type": row[1], "nullable": row[2] == 'YES'}
            for row in cur.fetchall()
        ]

    def fetch_data(self, table: str, limit: int = 100, offset: int = 0) -> list[dict]:
        cur = self._connection.cursor(MySQLdb.cursors.DictCursor)
        cur.execute(
            f"SELECT * FROM `{table}` LIMIT %s OFFSET %s",
            (limit, offset),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_row_count(self, table: str) -> int:
        cur = self._connection.cursor()
        cur.execute(f"SELECT COUNT(*) FROM `{table}`")
        return cur.fetchone()[0]
