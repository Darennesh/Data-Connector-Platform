from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import AuditLog

User = get_user_model()


class UserModelTests(TestCase):
    def test_create_user_default_role(self):
        user = User.objects.create_user(username="bob", password="pass1234")
        self.assertEqual(user.role, "user")

    def test_create_admin_user(self):
        user = User.objects.create_user(username="admin1", password="pass1234", role="admin")
        self.assertEqual(user.role, "admin")

    def test_str_representation(self):
        user = User.objects.create_user(username="alice", password="pass1234")
        self.assertEqual(str(user), "alice (user)")


class AuditLogModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="loguser", password="pass1234")

    def test_log_creates_entry(self):
        entry = AuditLog.log(self.user, "login", {"ip": "127.0.0.1"})
        self.assertEqual(entry.action, "login")
        self.assertEqual(entry.user, self.user)
        self.assertEqual(entry.detail, {"ip": "127.0.0.1"})

    def test_log_with_request_ip(self):
        class FakeRequest:
            META = {"REMOTE_ADDR": "10.0.0.1", "HTTP_X_FORWARDED_FOR": ""}
        entry = AuditLog.log(self.user, "register", request=FakeRequest())
        self.assertEqual(entry.ip_address, "10.0.0.1")

    def test_log_with_forwarded_ip(self):
        class FakeRequest:
            META = {"REMOTE_ADDR": "10.0.0.1", "HTTP_X_FORWARDED_FOR": "203.0.113.5, 10.0.0.1"}
        entry = AuditLog.log(self.user, "login", request=FakeRequest())
        self.assertEqual(entry.ip_address, "203.0.113.5")

    def test_ordering(self):
        AuditLog.log(self.user, "login")
        AuditLog.log(self.user, "register")
        logs = list(AuditLog.objects.values_list("action", flat=True))
        self.assertEqual(logs[0], "register")  # most recent first


class RegisterAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_success(self):
        resp = self.client.post("/api/accounts/register/", {
            "username": "newuser",
            "password": "securepass1",
            "email": "new@example.com",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["username"], "newuser")
        self.assertEqual(resp.data["role"], "user")  # forced to user
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_register_creates_audit_log(self):
        self.client.post("/api/accounts/register/", {
            "username": "audited",
            "password": "securepass1",
        })
        self.assertTrue(AuditLog.objects.filter(action="register").exists())

    def test_register_short_password(self):
        resp = self.client.post("/api/accounts/register/", {
            "username": "shortpw",
            "password": "12",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_username(self):
        User.objects.create_user(username="dup", password="somepass1")
        resp = self.client.post("/api/accounts/register/", {
            "username": "dup",
            "password": "anotherpass",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_cannot_set_admin_role(self):
        resp = self.client.post("/api/accounts/register/", {
            "username": "sneaky",
            "password": "securepass1",
            "role": "admin",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["role"], "user")  # role is read-only


class LoginAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="loginuser", password="testpass123")

    def test_login_returns_tokens(self):
        resp = self.client.post("/api/accounts/login/", {
            "username": "loginuser",
            "password": "testpass123",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_login_wrong_password(self):
        resp = self.client.post("/api/accounts/login/", {
            "username": "loginuser",
            "password": "wrongpass",
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class MeAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="meuser", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_me(self):
        resp = self.client.get("/api/accounts/me/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["username"], "meuser")

    def test_me_unauthenticated(self):
        client = APIClient()
        resp = client.get("/api/accounts/me/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class AdminUserViewSetTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin", password="pass1234", role="admin")
        self.user = User.objects.create_user(username="regular", password="pass1234", role="user")
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)
        self.user_client = APIClient()
        self.user_client.force_authenticate(user=self.user)

    def test_list_users_admin(self):
        resp = self.admin_client.get("/api/accounts/users/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["count"], 2)

    def test_list_users_non_admin_denied(self):
        resp = self.user_client.get("/api/accounts/users/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_toggle_active(self):
        resp = self.admin_client.patch(f"/api/accounts/users/{self.user.pk}/toggle-active/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_toggle_active_self_denied(self):
        resp = self.admin_client.patch(f"/api/accounts/users/{self.admin.pk}/toggle-active/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_set_role(self):
        resp = self.admin_client.patch(
            f"/api/accounts/users/{self.user.pk}/set-role/",
            {"role": "admin"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, "admin")

    def test_set_role_invalid(self):
        resp = self.admin_client.patch(
            f"/api/accounts/users/{self.user.pk}/set-role/",
            {"role": "superuser"},
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_set_role_cannot_remove_own_admin(self):
        resp = self.admin_client.patch(
            f"/api/accounts/users/{self.admin.pk}/set-role/",
            {"role": "user"},
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_toggle_active_creates_audit_log(self):
        self.admin_client.patch(f"/api/accounts/users/{self.user.pk}/toggle-active/")
        self.assertTrue(AuditLog.objects.filter(action="user_deactivated").exists())

    def test_set_role_creates_audit_log(self):
        self.admin_client.patch(
            f"/api/accounts/users/{self.user.pk}/set-role/",
            {"role": "admin"},
        )
        self.assertTrue(AuditLog.objects.filter(action="role_changed").exists())


class AuditLogAPITests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin", password="pass1234", role="admin")
        self.user = User.objects.create_user(username="regular", password="pass1234", role="user")
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)
        AuditLog.log(self.admin, "login")
        AuditLog.log(self.user, "register")

    def test_list_audit_logs_admin(self):
        resp = self.admin_client.get("/api/accounts/audit-logs/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["count"], 2)

    def test_filter_by_action(self):
        resp = self.admin_client.get("/api/accounts/audit-logs/?action=login")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for log in resp.data["results"]:
            self.assertEqual(log["action"], "login")

    def test_non_admin_denied(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.get("/api/accounts/audit-logs/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
