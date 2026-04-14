# Design Decisions — Data Connector Platform

This document explains the key architectural and implementation decisions made while building the Data Connector Platform, including **why** each approach was chosen over alternatives.

---

## 1. Architecture Overview

```
┌──────────────┐      ┌──────────────┐      ┌────────────────────────┐
│   Next.js    │◄────►│  Django DRF  │◄────►│   PostgreSQL (App DB)  │
│  (Frontend)  │ JWT  │  (Backend)   │      └────────────────────────┘
│  Port 3000   │      │  Port 8000   │
└──────────────┘      └──────┬───────┘
                             │ Connector Layer
                     ┌───────┼───────┬────────────┐
                     ▼       ▼       ▼            ▼
                   MySQL  MongoDB  ClickHouse  Oracle
                   :3307  :27017   :8123       (external)
```

**Decision:** A clear two-tier split (Next.js SPA + Django API) rather than a monolithic Django app with server-rendered templates.

**Why:** The requirement calls for an editable data grid with inline editing, cell-level state management, and live batch operations — all of which are complex client-side interactions best handled by React. Keeping the backend as a pure REST API also makes it testable independently and allows future consumers (mobile apps, CLI tools) to use the same API.

---

## 2. Connector Abstraction Layer

### Base Class (Abstract Base Class pattern)

```
DatabaseConnector (ABC)
├── connect() / disconnect()
├── test_connection()
├── get_tables() → list[str]
├── get_columns(table) → list[dict]
├── fetch_data(table, limit, offset) → list[dict]
├── get_row_count(table) → int
└── Context manager (__enter__ / __exit__)
```

**Decision:** Python's `abc.ABC` with `@abstractmethod` decorators for the connector interface, plus a context manager protocol.

**Why over a plain duck-typing approach:** Abstract methods enforce the contract at class definition time — if a new connector forgets to implement `fetch_data()`, it fails at import, not at runtime during a user request. The context manager ensures connections are always closed, even on exceptions.

### Factory Pattern (Dynamic Import)

```python
connectors = {
    'postgresql': 'connectors.engine.pg.PostgreSQLConnector',
    'mysql':      'connectors.engine.mysql.MySQLConnector',
    'mongodb':    'connectors.engine.mongo.MongoDBConnector',
    'clickhouse': 'connectors.engine.ch.ClickHouseConnector',
    'oracle':     'connectors.engine.oracle.OracleConnector',
}
```

**Decision:** A dictionary mapping db_type strings to fully-qualified class paths, resolved via `importlib.import_module()` at runtime.

**Why over direct imports:** Each connector has a heavy driver dependency (psycopg2, pymysql, pymongo, clickhouse-connect, oracledb). Importing them all at module load wastes memory and causes import errors if any driver is missing. Dynamic import means only the requested driver is loaded. To add a new database type, a developer only needs to:
1. Create a new file implementing `DatabaseConnector`
2. Add one line to the dictionary

**Why over a plugin/entry_points system:** The project has a fixed, known set of connectors. A full plugin discovery system (e.g., `importlib.metadata.entry_points`) would be over-engineering for this scope.

---

## 3. Authentication & Authorization

### JWT with SimpleJWT

**Decision:** Token-based auth using `djangorestframework-simplejwt` with 1-hour access tokens and 1-day refresh tokens, stored in `localStorage`.

**Why JWT over session cookies:**
- The frontend and backend run on different ports (3000 vs 8000), making cross-origin cookie management complex.
- JWT is stateless — no server-side session store needed, which keeps the backend horizontally scalable.
- The frontend's Axios interceptor automatically refreshes expired tokens, giving a seamless user experience.

**Why localStorage over httpOnly cookies:** Simpler implementation for the SPA pattern. The short token lifetime (1 hour) limits the exposure window. CORS is restricted to `http://localhost:3000`.

### Role-Based Access Control (RBAC)

```
User.role ∈ { 'admin', 'user' }

Permissions:
├── IsAdmin              — admin-only endpoints
├── IsAdminOrReadOnly    — anyone can read, admin can write
├── IsOwnerOrAdmin       — object owner or admin
└── IsOwnerOrAdminOrShared — owner, admin, or explicitly shared
```

**Decision:** A simple `role` field on the User model with four custom DRF permission classes, plus queryset-level filtering.

**Why over Django's built-in groups/permissions system:** The requirements specify exactly two roles (admin, user) with clear rules. Django's `Group` and `Permission` models would add database joins and complexity for a two-role system. A `CharField` with two choices is direct and readable.

**Why queryset filtering AND permission classes:** Defense in depth. The queryset ensures users only *see* their own data in list views. The permission class ensures they can't access individual objects via direct URL. Both layers must agree.

---

## 4. File Sharing Model

**Decision:** An explicit `FileShare` join table with `(file, shared_with)` unique constraint.

```
SubmissionFile ──< FileShare >── User
                   shared_by FK
```

**Why a dedicated model over a ManyToManyField:** The `FileShare` model carries extra metadata (`shared_by`, `created_at`) that a bare M2M through table would not provide. This supports audit trails ("who shared what, and when") which is important for a data platform handling potentially sensitive extracts.

---

## 5. Dual Storage (Database + File)

### Database Storage

**Decision:** `Submission.data` is a `JSONField` storing the full row data in PostgreSQL's native JSONB format.

**Why JSONField over separate normalized tables:** The extracted data has arbitrary schemas — each table from each database type has different columns. Creating dynamic relational tables at runtime would be fragile and complex. PostgreSQL's JSONB supports indexing and querying if needed later, while keeping the schema fixed.

### File Storage

**Decision:** Files are generated server-side in both JSON and CSV formats and stored via Django's `FileField` (backed by `MEDIA_ROOT` on disk, mounted as a Docker volume).

**Why server-side generation over client-side:** Ensures consistent formatting, includes source metadata (connection, db_type, table, timestamp, row count), and the files are stored alongside the submission record in a single atomic operation.

**Why both JSON and CSV:** JSON preserves types and nested structures (especially from MongoDB documents). CSV is universally importable by Excel, Google Sheets, and BI tools. Offering both covers the widest range of downstream use cases.

---

## 6. Batch Extraction Design

**Decision:** Configurable `limit` (default 100, hard cap 5000) and `offset` parameters on the extraction endpoints.

**Why a hard cap:** Unbounded queries against external databases could return millions of rows, exhausting memory on both the connector and the Django process. The 5000-row cap prevents accidental denial-of-service while allowing meaningful batch sizes.

**Why offset-based over cursor-based pagination:** Offset pagination is universally supported across PostgreSQL, MySQL, MongoDB, and ClickHouse with minimal implementation variance. Cursor pagination would require each connector to implement keyset logic differently.

---

## 7. Editable Data Grid

**Decision:** TanStack React Table v8 with custom edit state management (editMode toggle, per-cell dirty tracking, row add/delete markers).

**Why TanStack Table over AG Grid or a custom table:**
- **AG Grid:** Powerful but the full-featured version requires a commercial license. The community edition lacks some features.
- **Custom `<table>`:** Would require reimplementing column resizing, sorting, header rendering, and virtualization.
- **TanStack Table:** Headless (renders to whatever markup we want), fully typed, zero CSS opinions, and MIT-licensed. It handles the data model while we control the UI with Tailwind.

**Edit state design:** A `dirtySet` tracks which cells have been modified, allowing the "Submit Edits" action to send only changed rows. A `deletedRows` set marks rows for exclusion without mutating the data array.

---

## 8. Docker & Infrastructure

### Compose Architecture (6 containers)

| Container   | Purpose                     | Port  |
|------------|------------------------------|-------|
| postgres   | App database (Django models)  | 5432  |
| mysql      | Connector target (test data)  | 3307  |
| mongodb    | Connector target (test data)  | 27017 |
| clickhouse | Connector target (OLAP data)  | 8123  |
| backend    | Django + Gunicorn             | 8000  |
| frontend   | Next.js (standalone build)    | 3000  |

**Decision:** Each database runs in its own container with healthchecks. The backend depends on `postgres: healthy` to ensure migrations can run.

**Why MySQL on port 3307:** To avoid conflicting with any host-installed MySQL on the default 3306.

### Frontend Production Build

**Decision:** `output: 'standalone'` in next.config.js, running `node .next/standalone/server.js` in the container.

**Why over `npm run dev` in Docker:** Development mode recompiles on every request, taking 15-30 seconds per page load inside a container. The standalone build starts in ~200ms and serves pre-compiled pages. This is a **10-100x improvement** in page load time.

**Why over `npm run start`:** The standalone output is a self-contained Node.js server (~15MB) that includes only the necessary dependencies, resulting in a smaller Docker image.

---

## 9. Audit Logging

**Decision:** A dedicated `AuditLog` model storing `(user, action, details_json, ip_address, timestamp)` with a class method `AuditLog.log()` called from views.

**Why a custom model over Django's `LogEntry`:** Django's admin `LogEntry` is tightly coupled to the admin interface and doesn't capture custom actions like "connection_created" or "submission_created." A purpose-built model allows structured JSON details and is queryable via the API for admin dashboards.

---

## 10. Data Sanitization

**Decision:** A `_sanitize_rows()` helper that converts `datetime` → ISO string, `Decimal` → float, `bytes` → hex before storing in JSONField or exporting.

**Why:** PostgreSQL's `JSONField` and Python's `json.dumps()` cannot serialize these types natively. Rather than using a custom JSON encoder (which would need to be applied everywhere), the sanitization runs once on extraction, keeping all downstream code simple.

---

## 11. Oracle Connector (Thin Client)

**Decision:** Uses `oracledb` library in thin mode — no Oracle Instant Client installation required.

**Why over cx_Oracle:** `oracledb` is the official successor to `cx_Oracle` (renamed by Oracle themselves), supports thin mode without native libraries, and is actively maintained. This eliminates the need for an Oracle Docker container or client libraries in the backend image, keeping the Docker build simple.

**Why no Oracle in Docker Compose:** Oracle Database images require accepting license terms and are very large (~2-8GB). Since the connector uses thin mode, any external Oracle instance can be configured via the connection form.

---

## 12. Frontend State Management

**Decision:** React Context (`AuthProvider`) for auth state, local component state for everything else. No Redux, Zustand, or other state library.

**Why:** The app has exactly one piece of global state: the authenticated user. Every other state (connection lists, table data, edit buffers) is local to its page. Adding a state management library for one context value would be unnecessary complexity.

---

## 13. Testing Strategy

**Backend (60 tests across 17 classes):**
- **Model tests:** Verify creation, defaults, constraints, ordering
- **API tests:** Full request/response cycle using DRF's `APITestCase` with JWT authentication
- **Unit tests:** Sanitization functions, file export, factory pattern, permission classes

**Frontend (12 tests):**
- **API client tests:** Verify baseURL, interceptor behavior, token attachment
- **Component tests:** Basic rendering verification using Testing Library

**Why more backend than frontend tests:** The backend contains the business logic (permissions, data transformation, file generation). The frontend is primarily a presentation layer — its correctness is most efficiently verified through the walkthrough recording rather than unit-testing every JSX component.
