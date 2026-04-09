from clickhouse_driver import Client
from .base import DatabaseConnector


class ClickHouseConnector(DatabaseConnector):

    def connect(self):
        self._connection = Client(
            host=self.host,
            port=self.port,
            database=self.database,
            user=self.username or 'default',
            password=self.password or '',
        )

    def disconnect(self):
        if self._connection:
            self._connection.disconnect()
            self._connection = None

    def test_connection(self) -> bool:
        try:
            with self:
                result = self._connection.execute("SELECT 1")
                return result == [(1,)]
        except Exception:
            return False

    def get_tables(self) -> list[str]:
        rows = self._connection.execute("SHOW TABLES")
        return sorted([row[0] for row in rows])

    def get_columns(self, table: str) -> list[dict]:
        rows = self._connection.execute(
            "SELECT name, type FROM system.columns "
            "WHERE database = %(db)s AND table = %(tbl)s "
            "ORDER BY position",
            {"db": self.database, "tbl": table},
        )
        return [
            {"name": row[0], "type": row[1], "nullable": 'Nullable' in row[1]}
            for row in rows
        ]

    def fetch_data(self, table: str, limit: int = 100, offset: int = 0) -> list[dict]:
        cols = self.get_columns(table)
        col_names = [c["name"] for c in cols]
        rows = self._connection.execute(
            f"SELECT * FROM `{table}` LIMIT %(limit)s OFFSET %(offset)s",
            {"limit": limit, "offset": offset},
        )
        return [dict(zip(col_names, row)) for row in rows]

    def get_row_count(self, table: str) -> int:
        result = self._connection.execute(f"SELECT COUNT(*) FROM `{table}`")
        return result[0][0]
