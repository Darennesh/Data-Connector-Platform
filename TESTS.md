# Unit Tests — Data Connector Platform

This document catalogs all unit tests in the project, organized by module.

---

## Summary

| Module             | Test File                              | Classes | Tests  | Focus Area                               |
| ------------------ | -------------------------------------- | ------- | ------ | ---------------------------------------- |
| **accounts**       | `backend/accounts/tests.py`            | 5       | 21     | User model, auth API, admin operations   |
| **connectors**     | `backend/connectors/tests.py`          | 4       | 15     | Connection model, factory, API endpoints |
| **submissions**    | `backend/submissions/tests.py`         | 6       | 21     | Sanitization, export, extract, sharing   |
| **frontend/api**   | `frontend/src/__tests__/api.test.ts`   | 1       | 5      | Axios client, JWT interceptor            |
| **frontend/types** | `frontend/src/__tests__/types.test.ts` | 1       | 7      | TypeScript interface validation          |
| **Total**          |                                        | **17**  | **69** |                                          |

---

## How to Run

```bash
# All backend tests (Django)
docker compose exec backend python manage.py test --verbosity=2

# All frontend tests (Jest)
docker compose exec frontend npx jest --passWithNoTests --verbose

# Single backend module
docker compose exec backend python manage.py test accounts --verbosity=2
docker compose exec backend python manage.py test connectors --verbosity=2
docker compose exec backend python manage.py test submissions --verbosity=2
```

---

## Backend Tests

### 1. `accounts/tests.py` — Authentication & User Management

#### `UserModelTests` (3 tests)

| Test                            | What it verifies                         |
| ------------------------------- | ---------------------------------------- |
| `test_create_user_default_role` | New users default to `role='user'`       |
| `test_create_admin_user`        | Users can be created with `role='admin'` |
| `test_str_representation`       | `__str__` returns `"username (role)"`    |

#### `AuditLogModelTests` (4 tests)

| Test                         | What it verifies                                                 |
| ---------------------------- | ---------------------------------------------------------------- |
| `test_log_creates_entry`     | `AuditLog.log()` creates a record with correct action and detail |
| `test_log_with_request_ip`   | IP is extracted from `REMOTE_ADDR`                               |
| `test_log_with_forwarded_ip` | IP is extracted from `X-Forwarded-For` header (proxy support)    |
| `test_ordering`              | Logs are ordered most-recent-first                               |

#### `RegisterAPITests` (5 tests)

| Test                                  | What it verifies                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `test_register_success`               | `POST /api/accounts/register/` creates user with correct fields              |
| `test_register_creates_audit_log`     | Registration creates an audit trail entry                                    |
| `test_register_short_password`        | Passwords < minimum length are rejected (400)                                |
| `test_register_duplicate_username`    | Duplicate usernames are rejected (400)                                       |
| `test_register_cannot_set_admin_role` | **Security:** `role` field is read-only — users cannot self-promote to admin |

#### `LoginAPITests` (2 tests)

| Test                        | What it verifies                                           |
| --------------------------- | ---------------------------------------------------------- |
| `test_login_returns_tokens` | Successful login returns `access` and `refresh` JWT tokens |
| `test_login_wrong_password` | Invalid credentials return 401                             |

#### `MeAPITests` (2 tests)

| Test                      | What it verifies                               |
| ------------------------- | ---------------------------------------------- |
| `test_get_me`             | Authenticated user can fetch their own profile |
| `test_me_unauthenticated` | Unauthenticated requests get 401               |

#### `AdminUserViewSetTests` (9 tests)

| Test                                    | What it verifies                                  |
| --------------------------------------- | ------------------------------------------------- |
| `test_list_users_admin`                 | Admins can list all users                         |
| `test_list_users_non_admin_denied`      | Non-admins get 403 on user list                   |
| `test_toggle_active`                    | Admin can deactivate a user                       |
| `test_toggle_active_self_denied`        | **Safety:** Admin cannot deactivate themselves    |
| `test_set_role`                         | Admin can change another user's role              |
| `test_set_role_invalid`                 | Invalid role values are rejected (400)            |
| `test_set_role_cannot_remove_own_admin` | **Safety:** Admin cannot downgrade their own role |
| `test_toggle_active_creates_audit_log`  | Deactivation is logged                            |
| `test_set_role_creates_audit_log`       | Role changes are logged                           |

---

### 2. `connectors/tests.py` — Database Connections

#### `ConnectionConfigModelTests` (2 tests)

| Test                              | What it verifies                                           |
| --------------------------------- | ---------------------------------------------------------- |
| `test_create_connection`          | Connection model creates with correct fields and `__str__` |
| `test_ordering_most_recent_first` | Connections ordered by `-created_at`                       |

#### `ConnectorFactoryTests` (5 tests)

| Test                           | What it verifies                                         |
| ------------------------------ | -------------------------------------------------------- |
| `test_unsupported_db_type`     | Unknown db_type raises `ValueError`                      |
| `test_creates_pg_connector`    | Factory creates `PostgreSQLConnector` for `'postgresql'` |
| `test_creates_mysql_connector` | Factory creates `MySQLConnector` for `'mysql'`           |
| `test_creates_mongo_connector` | Factory creates `MongoDBConnector` for `'mongodb'`       |
| `test_creates_ch_connector`    | Factory creates `ClickHouseConnector` for `'clickhouse'` |

#### `DatabaseConnectorBaseTests` (1 test)

| Test                   | What it verifies                                                        |
| ---------------------- | ----------------------------------------------------------------------- |
| `test_context_manager` | ABC's `__enter__`/`__exit__` calls `connect()`/`disconnect()` correctly |

#### `ConnectionConfigAPITests` (10 tests)

| Test                                     | What it verifies                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `test_create_connection`                 | `POST /api/connectors/` creates connection; password is write-only          |
| `test_list_own_connections`              | User sees only their own connections                                        |
| `test_other_user_cannot_see_connections` | **Isolation:** Other users see 0 results                                    |
| `test_admin_sees_all_connections`        | Admin sees all connections across users                                     |
| `test_delete_connection`                 | Owner can delete their connection                                           |
| `test_unauthenticated_denied`            | Unauthenticated requests get 401                                            |
| `test_test_connection`                   | `POST /api/connectors/{id}/test/` calls the connector's `test_connection()` |
| `test_list_tables`                       | `GET /api/connectors/{id}/tables/` returns table list from connector        |
| `test_table_columns`                     | `GET /api/connectors/{id}/tables/{name}/columns/` returns column metadata   |
| `test_preview_data`                      | `GET /api/connectors/{id}/preview/` returns preview rows                    |

> **Mocking strategy:** Connector tests use `@patch` to mock the `ConnectorFactory` and connector methods, avoiding real database connections.

---

### 3. `submissions/tests.py` — Data Extraction & Sharing

#### `SanitizeTests` (5 tests)

| Test                         | What it verifies                             |
| ---------------------------- | -------------------------------------------- |
| `test_datetime_to_isoformat` | `datetime` → ISO 8601 string                 |
| `test_decimal_to_float`      | `Decimal` → Python `float`                   |
| `test_bytes_to_hex`          | `bytes` → hex string                         |
| `test_passthrough`           | Strings, ints, `None` pass through unchanged |
| `test_sanitize_rows`         | Full row sanitization across all types       |

#### `ExportTests` (3 tests)

| Test                    | What it verifies                                           |
| ----------------------- | ---------------------------------------------------------- |
| `test_export_json`      | JSON export contains data and has correct filename pattern |
| `test_export_csv`       | CSV export has header row and data rows                    |
| `test_export_csv_empty` | Empty rows produce empty CSV (no crash)                    |

#### `SubmissionModelTests` (2 tests)

| Test                       | What it verifies                                |
| -------------------------- | ----------------------------------------------- |
| `test_create_submission`   | Model creates with correct fields and `__str__` |
| `test_submission_ordering` | Submissions ordered by `-created_at`            |

#### `ExtractAndSubmitAPITests` (5 tests)

| Test                                        | What it verifies                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `test_extract_and_submit`                   | Full flow: submit edited data → creates submission + file + audit log    |
| `test_extract_multiple_formats`             | Both JSON and CSV files generated when `export_formats: ["json", "csv"]` |
| `test_extract_connection_not_found`         | Invalid `connection_id` returns 404                                      |
| `test_extract_permission_denied_other_user` | **Security:** User cannot submit against another user's connection       |
| `test_extract_admin_can_use_any_connection` | Admin can submit against any user's connection                           |

#### `FetchAndSubmitAPITests` (2 tests)

| Test                              | What it verifies                                                         |
| --------------------------------- | ------------------------------------------------------------------------ |
| `test_fetch_and_submit`           | Fetches from mocked connector, creates submission with correct row count |
| `test_fetch_connection_not_found` | Invalid `connection_id` returns 404                                      |

#### `SubmissionListAPITests` (2 tests)

| Test                             | What it verifies                                            |
| -------------------------------- | ----------------------------------------------------------- |
| `test_user_sees_own_submissions` | **Isolation:** Regular user sees only their own submissions |
| `test_admin_sees_all`            | Admin sees all submissions                                  |

#### `FileShareAPITests` (7 tests)

| Test                                 | What it verifies                                                  |
| ------------------------------------ | ----------------------------------------------------------------- |
| `test_share_file`                    | `POST /api/submissions/shares/share/` creates a FileShare record  |
| `test_share_creates_audit_log`       | File sharing is logged                                            |
| `test_share_already_shared`          | Re-sharing returns 200 with "Already shared" message (idempotent) |
| `test_share_file_not_found`          | Invalid `file_id` returns 404                                     |
| `test_share_user_not_found`          | Invalid `shared_with_username` returns 404                        |
| `test_non_owner_cannot_share`        | **Security:** Non-owner cannot share someone else's file          |
| `test_shared_file_visible_to_target` | Shared file appears in target user's file list                    |

---

## Frontend Tests

### 4. `__tests__/api.test.ts` — Axios Client Configuration

| Test                                           | What it verifies                                             |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `creates axios instance with correct baseURL`  | Client points to `/api`                                      |
| `registers request and response interceptors`  | Both interceptors are attached                               |
| `request interceptor attaches Bearer token`    | Token from `localStorage` is added to `Authorization` header |
| `request interceptor skips token when not set` | No header when no token stored                               |
| `request interceptor returns config object`    | Interceptor doesn't mutate the chain                         |

### 5. `__tests__/types.test.ts` — TypeScript Interface Validation

| Test                                                | What it verifies                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `User interface has correct shape`                  | `User` type compiles with expected fields                            |
| `Connection interface has correct shape`            | `Connection` type with `db_type` field                               |
| `Submission interface includes files array`         | `Submission` type includes `files: []`                               |
| `PaginatedResponse wraps results correctly`         | Generic pagination type works with `User`                            |
| `FileShare interface has sharing metadata`          | `FileShare` includes `shared_with_username` and `shared_by_username` |
| `AuditLog interface has action and detail`          | `AuditLog` type with `action` and JSON `detail`                      |
| `Connection db_type is restricted to valid choices` | Union type has 4 valid database choices                              |

---

## Test Categories

| Category                  | Count | Purpose                                                |
| ------------------------- | ----- | ------------------------------------------------------ |
| **Model tests**           | 12    | Verify model creation, defaults, constraints, ordering |
| **API integration tests** | 36    | Full request → response cycle with authentication      |
| **Unit tests**            | 9     | Pure function testing (sanitize, export, factory)      |
| **Security tests**        | 7     | RBAC enforcement, self-promotion prevention, isolation |
| **Frontend tests**        | 12    | Client config, interceptors, type safety               |
| **Audit tests**           | 5     | Verify actions create audit trail entries              |

---

## Testing Patterns Used

- **`APITestCase` + `force_authenticate()`** — Skip JWT token exchange, test business logic directly
- **`@patch` / `MagicMock`** — Mock database connectors to avoid needing live DB connections in tests
- **Multi-user setup** — Tests create `owner`, `other`, and `admin` users to verify isolation
- **`jest.mock("axios")`** — Frontend mocks axios to test interceptor behavior without network calls
- **Type instantiation tests** — Verify TypeScript interfaces compile and accept expected shapes
