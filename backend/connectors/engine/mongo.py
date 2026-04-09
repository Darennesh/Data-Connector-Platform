from pymongo import MongoClient
from .base import DatabaseConnector


class MongoDBConnector(DatabaseConnector):

    def connect(self):
        self._connection = MongoClient(
            host=self.host,
            port=self.port,
            username=self.username or None,
            password=self.password or None,
            authSource='admin',
            serverSelectionTimeoutMS=5000,
        )
        self._db = self._connection[self.database]

    def disconnect(self):
        if self._connection:
            self._connection.close()
            self._connection = None
            self._db = None

    def test_connection(self) -> bool:
        try:
            with self:
                self._connection.admin.command('ping')
                return True
        except Exception:
            return False

    def get_tables(self) -> list[str]:
        return sorted(self._db.list_collection_names())

    def get_columns(self, table: str) -> list[dict]:
        """Infer fields from a sample of documents."""
        collection = self._db[table]
        sample = list(collection.find().limit(50))
        if not sample:
            return []
        fields = {}
        for doc in sample:
            for key, value in doc.items():
                if key not in fields:
                    fields[key] = type(value).__name__
        return [
            {"name": k, "type": v, "nullable": True}
            for k, v in fields.items()
        ]

    def fetch_data(self, table: str, limit: int = 100, offset: int = 0) -> list[dict]:
        collection = self._db[table]
        docs = list(collection.find().skip(offset).limit(limit))
        for doc in docs:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
        return docs

    def get_row_count(self, table: str) -> int:
        return self._db[table].estimated_document_count()
