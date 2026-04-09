"""
Abstract base class for all database connectors.
Each concrete connector must implement these methods.
"""
from abc import ABC, abstractmethod
from typing import Any


class DatabaseConnector(ABC):
    """Base interface for database connectors."""

    def __init__(self, host: str, port: int, database: str,
                 username: str = '', password: str = ''):
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self._connection = None

    @abstractmethod
    def connect(self):
        """Establish a connection to the database."""

    @abstractmethod
    def disconnect(self):
        """Close the database connection."""

    @abstractmethod
    def test_connection(self) -> bool:
        """Test if the connection is valid. Returns True on success."""

    @abstractmethod
    def get_tables(self) -> list[str]:
        """Return a list of table/collection names."""

    @abstractmethod
    def get_columns(self, table: str) -> list[dict[str, Any]]:
        """Return column metadata for a table: [{"name": ..., "type": ...}, ...]"""

    @abstractmethod
    def fetch_data(self, table: str, limit: int = 100, offset: int = 0) -> list[dict]:
        """Fetch rows from a table with pagination."""

    @abstractmethod
    def get_row_count(self, table: str) -> int:
        """Return the total row count for a table."""

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()
