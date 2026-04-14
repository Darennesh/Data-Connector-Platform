import oracledb
from .base import DatabaseConnector


class OracleConnector(DatabaseConnector):

    def connect(self):
        self._connection = oracledb.connect(
            user=self.username,
            password=self.password,
            dsn=f"{self.host}:{self.port}/{self.database}",
        )

    def disconnect(self):
        if self._connection:
            try:
                self._connection.close()
            except Exception:
                pass
            self._connection = None

    def test_connection(self) -> bool:
        try:
            with self:
                cur = self._connection.cursor()
                cur.execute("SELECT 1 FROM DUAL")
                return True
        except Exception:
            return False

    def get_tables(self) -> list[str]:
        cur = self._connection.cursor()
        cur.execute("""
            SELECT table_name FROM user_tables
            ORDER BY table_name
        """)
        return [row[0] for row in cur.fetchall()]

    def get_columns(self, table: str) -> list[dict]:
        cur = self._connection.cursor()
        cur.execute("""
            SELECT column_name, data_type, nullable
            FROM user_tab_columns
            WHERE table_name = :tbl
            ORDER BY column_id
        """, {"tbl": table.upper()})
        return [
            {"name": row[0], "type": row[1], "nullable": row[2] == 'Y'}
            for row in cur.fetchall()
        ]

    def fetch_data(self, table: str, limit: int = 100, offset: int = 0) -> list[dict]:
        cur = self._connection.cursor()
        cur.execute(
            f"SELECT * FROM \"{table}\" OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY",
            {"off": offset, "lim": limit},
        )
        columns = [desc[0] for desc in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]

    def get_row_count(self, table: str) -> int:
        cur = self._connection.cursor()
        cur.execute(f"SELECT COUNT(*) FROM \"{table}\"")
        return cur.fetchone()[0]
