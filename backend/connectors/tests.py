from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import ConnectionConfig
from .engine.base import DatabaseConnector
from .engine.factory import ConnectorFactory

User = get_user_model()


class ConnectionConfigModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="connuser", password="pass1234")

    def test_create_connection(self):
        conn = ConnectionConfig.objects.create(
            name="TestPG", db_type="postgresql",
            host="localhost", port=5432, database="testdb",
            username="pguser", password="pgpass",
            owner=self.user,
        )
        self.assertEqual(str(conn), "TestPG (postgresql)")
        self.assertEqual(conn.owner, self.user)

    def test_ordering_most_recent_first(self):
        c1 = ConnectionConfig.objects.create(
            name="First", db_type="mysql",
            host="h", port=3306, database="db", owner=self.user,
        )
        c2 = ConnectionConfig.objects.create(
            name="Second", db_type="postgresql",
            host="h", port=5432, database="db", owner=self.user,
        )
        configs = list(ConnectionConfig.objects.all())
        self.assertEqual(configs[0].name, "Second")


class ConnectorFactoryTests(TestCase):
    def test_unsupported_db_type(self):
        with self.assertRaises(ValueError):
            ConnectorFactory(db_type="oracle", host="h", port=1521, database="db")

    @patch("connectors.engine.pg.PostgreSQLConnector", autospec=True)
    def test_creates_pg_connector(self, mock_cls):
        ConnectorFactory(db_type="postgresql", host="h", port=5432, database="db")
        mock_cls.assert_called_once()

    @patch("connectors.engine.mysql.MySQLConnector", autospec=True)
    def test_creates_mysql_connector(self, mock_cls):
        ConnectorFactory(db_type="mysql", host="h", port=3306, database="db")
        mock_cls.assert_called_once()

    @patch("connectors.engine.mongo.MongoDBConnector", autospec=True)
    def test_creates_mongo_connector(self, mock_cls):
        ConnectorFactory(db_type="mongodb", host="h", port=27017, database="db")
        mock_cls.assert_called_once()

    @patch("connectors.engine.ch.ClickHouseConnector", autospec=True)
    def test_creates_ch_connector(self, mock_cls):
        ConnectorFactory(db_type="clickhouse", host="h", port=9000, database="db")
        mock_cls.assert_called_once()


class DatabaseConnectorBaseTests(TestCase):
    """Test the context manager protocol on the base class."""

    def test_context_manager(self):
        class FakeConnector(DatabaseConnector):
            connected = False
            disconnected = False

            def connect(self):
                self.connected = True

            def disconnect(self):
                self.disconnected = True

            def test_connection(self):
                return True

            def get_tables(self):
                return []

            def get_columns(self, table):
                return []

            def fetch_data(self, table, limit=100, offset=0):
                return []

            def get_row_count(self, table):
                return 0

        connector = FakeConnector(host="h", port=0, database="db")
        with connector as c:
            self.assertTrue(c.connected)
        self.assertTrue(connector.disconnected)


class ConnectionConfigAPITests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin", password="pass1234", role="admin")
        self.user = User.objects.create_user(username="regular", password="pass1234", role="user")
        self.other_user = User.objects.create_user(username="other", password="pass1234", role="user")
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)
        self.user_client = APIClient()
        self.user_client.force_authenticate(user=self.user)
        self.other_client = APIClient()
        self.other_client.force_authenticate(user=self.other_user)

    def _create_conn(self, client=None, **overrides):
        client = client or self.user_client
        data = {
            "name": "TestConn",
            "db_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "mydb",
            "username": "pguser",
            "password": "pgpass",
        }
        data.update(overrides)
        return client.post("/api/connectors/", data)

    def test_create_connection(self):
        resp = self._create_conn()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["name"], "TestConn")
        self.assertNotIn("password", resp.data)  # write_only

    def test_list_own_connections(self):
        self._create_conn(name="Conn1")
        self._create_conn(name="Conn2")
        resp = self.user_client.get("/api/connectors/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 2)

    def test_other_user_cannot_see_connections(self):
        self._create_conn()
        resp = self.other_client.get("/api/connectors/")
        self.assertEqual(resp.data["count"], 0)

    def test_admin_sees_all_connections(self):
        self._create_conn()
        self._create_conn(client=self.other_client, name="OtherConn")
        resp = self.admin_client.get("/api/connectors/")
        self.assertEqual(resp.data["count"], 2)

    def test_delete_connection(self):
        resp = self._create_conn()
        conn_id = resp.data["id"]
        del_resp = self.user_client.delete(f"/api/connectors/{conn_id}/")
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ConnectionConfig.objects.filter(pk=conn_id).exists())

    def test_unauthenticated_denied(self):
        client = APIClient()
        resp = client.get("/api/connectors/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("connectors.views.ConnectorFactory")
    def test_test_connection(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.test_connection.return_value = True
        mock_factory.return_value = mock_connector
        resp = self._create_conn()
        conn_id = resp.data["id"]
        test_resp = self.user_client.post(f"/api/connectors/{conn_id}/test/")
        self.assertEqual(test_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(test_resp.data["ok"])

    @patch("connectors.views.ConnectorFactory")
    def test_list_tables(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.__enter__ = MagicMock(return_value=mock_connector)
        mock_connector.__exit__ = MagicMock(return_value=False)
        mock_connector.get_tables.return_value = ["users", "orders"]
        mock_factory.return_value = mock_connector
        resp = self._create_conn()
        conn_id = resp.data["id"]
        tables_resp = self.user_client.get(f"/api/connectors/{conn_id}/tables/")
        self.assertEqual(tables_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(tables_resp.data["tables"], ["users", "orders"])

    @patch("connectors.views.ConnectorFactory")
    def test_table_columns(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.__enter__ = MagicMock(return_value=mock_connector)
        mock_connector.__exit__ = MagicMock(return_value=False)
        mock_connector.get_columns.return_value = [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "name", "type": "varchar", "nullable": True},
        ]
        mock_factory.return_value = mock_connector
        resp = self._create_conn()
        conn_id = resp.data["id"]
        col_resp = self.user_client.get(f"/api/connectors/{conn_id}/tables/users/columns/")
        self.assertEqual(col_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(col_resp.data["columns"]), 2)

    @patch("connectors.views.ConnectorFactory")
    def test_table_data(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.__enter__ = MagicMock(return_value=mock_connector)
        mock_connector.__exit__ = MagicMock(return_value=False)
        mock_connector.fetch_data.return_value = [{"id": 1, "name": "Alice"}]
        mock_connector.get_row_count.return_value = 1
        mock_connector.get_columns.return_value = [{"name": "id", "type": "int"}]
        mock_factory.return_value = mock_connector
        resp = self._create_conn()
        conn_id = resp.data["id"]
        data_resp = self.user_client.get(f"/api/connectors/{conn_id}/tables/users/data/")
        self.assertEqual(data_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(data_resp.data["rows"]), 1)
        self.assertEqual(data_resp.data["total"], 1)

    @patch("connectors.views.ConnectorFactory")
    def test_table_row_count(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.__enter__ = MagicMock(return_value=mock_connector)
        mock_connector.__exit__ = MagicMock(return_value=False)
        mock_connector.get_row_count.return_value = 42
        mock_factory.return_value = mock_connector
        resp = self._create_conn()
        conn_id = resp.data["id"]
        count_resp = self.user_client.get(f"/api/connectors/{conn_id}/tables/orders/count/")
        self.assertEqual(count_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(count_resp.data["count"], 42)

    def test_create_connection_creates_audit_log(self):
        from accounts.models import AuditLog
        self._create_conn()
        self.assertTrue(AuditLog.objects.filter(action="connection_created").exists())

    def test_delete_connection_creates_audit_log(self):
        from accounts.models import AuditLog
        resp = self._create_conn()
        self.user_client.delete(f"/api/connectors/{resp.data['id']}/")
        self.assertTrue(AuditLog.objects.filter(action="connection_deleted").exists())
