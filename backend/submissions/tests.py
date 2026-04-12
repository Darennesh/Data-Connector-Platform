from unittest.mock import patch, MagicMock
from datetime import datetime
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from connectors.models import ConnectionConfig
from accounts.models import AuditLog
from .models import Submission, SubmissionFile, FileShare
from .views import _sanitize_value, _sanitize_rows, _export_json, _export_csv

User = get_user_model()


class SanitizeTests(TestCase):
    def test_datetime_to_isoformat(self):
        dt = datetime(2025, 1, 15, 12, 30, 0)
        self.assertEqual(_sanitize_value(dt), "2025-01-15T12:30:00")

    def test_decimal_to_float(self):
        self.assertEqual(_sanitize_value(Decimal("3.14")), 3.14)

    def test_bytes_to_hex(self):
        self.assertEqual(_sanitize_value(b"\xde\xad"), "dead")

    def test_passthrough(self):
        self.assertEqual(_sanitize_value("hello"), "hello")
        self.assertEqual(_sanitize_value(42), 42)
        self.assertIsNone(_sanitize_value(None))

    def test_sanitize_rows(self):
        rows = [{"ts": datetime(2025, 1, 1), "amount": Decimal("9.99"), "name": "Bob"}]
        result = _sanitize_rows(rows)
        self.assertEqual(result[0]["ts"], "2025-01-01T00:00:00")
        self.assertEqual(result[0]["amount"], 9.99)
        self.assertEqual(result[0]["name"], "Bob")


class ExportTests(TestCase):
    def test_export_json(self):
        rows = [{"id": 1, "name": "Alice"}]
        f = _export_json(rows, "users")
        content = f.read().decode("utf-8")
        self.assertIn('"Alice"', content)
        self.assertTrue(f.name.startswith("users_"))
        self.assertTrue(f.name.endswith(".json"))

    def test_export_csv(self):
        rows = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        f = _export_csv(rows, "users")
        content = f.read().decode("utf-8")
        self.assertIn("id,name", content)
        self.assertIn("Alice", content)
        self.assertIn("Bob", content)

    def test_export_csv_empty(self):
        f = _export_csv([], "empty")
        content = f.read().decode("utf-8")
        self.assertEqual(content, "")


class SubmissionModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="subuser", password="pass1234")
        self.conn = ConnectionConfig.objects.create(
            name="PG", db_type="postgresql",
            host="localhost", port=5432, database="db",
            owner=self.user,
        )

    def test_create_submission(self):
        sub = Submission.objects.create(
            connection=self.conn, table_name="users",
            row_count=2, data=[{"id": 1}, {"id": 2}],
            owner=self.user,
        )
        self.assertEqual(str(sub), f"Submission {sub.id} - users")
        self.assertEqual(sub.row_count, 2)

    def test_submission_ordering(self):
        s1 = Submission.objects.create(
            connection=self.conn, table_name="t1",
            row_count=0, data=[], owner=self.user,
        )
        s2 = Submission.objects.create(
            connection=self.conn, table_name="t2",
            row_count=0, data=[], owner=self.user,
        )
        subs = list(Submission.objects.all())
        self.assertEqual(subs[0].table_name, "t2")


class ExtractAndSubmitAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="subuser", password="pass1234")
        self.other = User.objects.create_user(username="other", password="pass1234")
        self.admin = User.objects.create_user(username="admin", password="pass1234", role="admin")
        self.conn = ConnectionConfig.objects.create(
            name="PG", db_type="postgresql",
            host="localhost", port=5432, database="db",
            username="u", password="p", owner=self.user,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_extract_and_submit(self):
        resp = self.client.post("/api/submissions/extract/", {
            "connection_id": self.conn.id,
            "table_name": "products",
            "data": [{"id": 1, "name": "Widget"}],
            "export_formats": ["json"],
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["table_name"], "products")
        self.assertEqual(resp.data["row_count"], 1)
        self.assertEqual(len(resp.data["files"]), 1)
        # Audit log created
        self.assertTrue(AuditLog.objects.filter(action="submission_created").exists())

    def test_extract_multiple_formats(self):
        resp = self.client.post("/api/submissions/extract/", {
            "connection_id": self.conn.id,
            "table_name": "items",
            "data": [{"a": 1}],
            "export_formats": ["json", "csv"],
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp.data["files"]), 2)

    def test_extract_connection_not_found(self):
        resp = self.client.post("/api/submissions/extract/", {
            "connection_id": 9999,
            "table_name": "t",
            "data": [{"a": 1}],
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_extract_permission_denied_other_user(self):
        other_client = APIClient()
        other_client.force_authenticate(user=self.other)
        resp = other_client.post("/api/submissions/extract/", {
            "connection_id": self.conn.id,
            "table_name": "t",
            "data": [{"a": 1}],
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_extract_admin_can_use_any_connection(self):
        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)
        resp = admin_client.post("/api/submissions/extract/", {
            "connection_id": self.conn.id,
            "table_name": "t",
            "data": [{"a": 1}],
            "export_formats": ["json"],
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


class FetchAndSubmitAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="fetchuser", password="pass1234")
        self.conn = ConnectionConfig.objects.create(
            name="PG", db_type="postgresql",
            host="localhost", port=5432, database="db",
            username="u", password="p", owner=self.user,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("submissions.views.ConnectorFactory")
    def test_fetch_and_submit(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.__enter__ = MagicMock(return_value=mock_connector)
        mock_connector.__exit__ = MagicMock(return_value=False)
        mock_connector.fetch_data.return_value = [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"},
        ]
        mock_factory.return_value = mock_connector

        resp = self.client.post("/api/submissions/fetch-and-submit/", {
            "connection_id": self.conn.id,
            "table_name": "users",
            "limit": 100,
            "offset": 0,
            "export_formats": ["json"],
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["row_count"], 2)

    def test_fetch_connection_not_found(self):
        resp = self.client.post("/api/submissions/fetch-and-submit/", {
            "connection_id": 9999,
            "table_name": "t",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class SubmissionListAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="lister", password="pass1234")
        self.other = User.objects.create_user(username="other", password="pass1234")
        self.admin = User.objects.create_user(username="admin", password="pass1234", role="admin")
        self.conn = ConnectionConfig.objects.create(
            name="C", db_type="postgresql",
            host="h", port=5432, database="db", owner=self.user,
        )
        Submission.objects.create(
            connection=self.conn, table_name="t1",
            row_count=1, data=[{"a": 1}], owner=self.user,
        )
        Submission.objects.create(
            connection=self.conn, table_name="t2",
            row_count=1, data=[{"b": 2}], owner=self.other,
        )

    def test_user_sees_own_submissions(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.get("/api/submissions/")
        self.assertEqual(resp.data["count"], 1)

    def test_admin_sees_all(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        resp = client.get("/api/submissions/")
        self.assertEqual(resp.data["count"], 2)


class FileShareAPITests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass1234")
        self.target = User.objects.create_user(username="target", password="pass1234")
        self.conn = ConnectionConfig.objects.create(
            name="C", db_type="postgresql",
            host="h", port=5432, database="db", owner=self.owner,
        )
        self.sub = Submission.objects.create(
            connection=self.conn, table_name="t",
            row_count=0, data=[], owner=self.owner,
        )
        self.sf = SubmissionFile.objects.create(
            submission=self.sub,
            format="json",
            owner=self.owner,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_share_file(self):
        resp = self.client.post("/api/submissions/shares/share/", {
            "file_id": self.sf.id,
            "shared_with_username": "target",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(FileShare.objects.filter(
            file=self.sf, shared_with=self.target,
        ).exists())

    def test_share_creates_audit_log(self):
        self.client.post("/api/submissions/shares/share/", {
            "file_id": self.sf.id,
            "shared_with_username": "target",
        })
        self.assertTrue(AuditLog.objects.filter(action="file_shared").exists())

    def test_share_already_shared(self):
        FileShare.objects.create(
            file=self.sf, shared_with=self.target, shared_by=self.owner,
        )
        resp = self.client.post("/api/submissions/shares/share/", {
            "file_id": self.sf.id,
            "shared_with_username": "target",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("Already shared", resp.data["message"])

    def test_share_file_not_found(self):
        resp = self.client.post("/api/submissions/shares/share/", {
            "file_id": 9999,
            "shared_with_username": "target",
        })
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_share_user_not_found(self):
        resp = self.client.post("/api/submissions/shares/share/", {
            "file_id": self.sf.id,
            "shared_with_username": "nonexistent",
        })
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_owner_cannot_share(self):
        other_client = APIClient()
        other_client.force_authenticate(user=self.target)
        resp = other_client.post("/api/submissions/shares/share/", {
            "file_id": self.sf.id,
            "shared_with_username": "owner",
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_shared_file_visible_to_target(self):
        FileShare.objects.create(
            file=self.sf, shared_with=self.target, shared_by=self.owner,
        )
        target_client = APIClient()
        target_client.force_authenticate(user=self.target)
        resp = target_client.get("/api/submissions/files/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        file_ids = [f["id"] for f in resp.data["results"]]
        self.assertIn(self.sf.id, file_ids)
