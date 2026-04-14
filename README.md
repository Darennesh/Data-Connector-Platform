# Data Connector Platform

A full-stack web application for connecting to multiple databases, browsing and editing data in real-time, and extracting batches with dual storage (database + file). Built with **Next.js**, **Django REST Framework**, and **Docker**.

---

## Features

- **Multi-database connectors** — PostgreSQL, MySQL, MongoDB, ClickHouse, Oracle
- **Editable data grid** — Inline editing, row add/delete, batch submit
- **Batch extraction** — Configurable batch size (up to 5,000 rows)
- **Dual storage** — Every submission saved to DB (JSONField) + exported as JSON and CSV files with source metadata
- **Role-based access control** — Admin (full access) and User (own data + shared files)
- **File sharing** — Share exported files with other users
- **Audit logging** — All actions tracked with user, IP, and timestamp
- **JWT authentication** — Automatic token refresh, secure API
- **Containerized** — 6 Docker containers, one command to start

---

## Tech Stack

| Layer      | Technology                                            |
| ---------- | ----------------------------------------------------- |
| Frontend   | Next.js 14, React 18, TypeScript, Tailwind CSS        |
| Backend    | Django 4.2, Django REST Framework 3.14                |
| Auth       | SimpleJWT (access + refresh tokens)                   |
| App DB     | PostgreSQL 16                                         |
| Connectors | PostgreSQL, MySQL 8, MongoDB 7, ClickHouse 24, Oracle |
| Data Grid  | TanStack React Table v8                               |
| Containers | Docker + Docker Compose                               |

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/Darennesh/Data-Connector-Platform.git
cd Data-Connector-Platform

# Start all services (first run takes a few minutes to build)
docker compose up -d --build

# Verify all 6 containers are running
docker compose ps
```

### Access

| Service    | URL                       |
| ---------- | ------------------------- |
| Frontend   | http://localhost:3000     |
| Backend    | http://localhost:8000/api |
| PostgreSQL | localhost:5432            |
| MySQL      | localhost:3307            |
| MongoDB    | localhost:27017           |
| ClickHouse | localhost:8123            |

### First-Time Usage

1. Open http://localhost:3000 and click **Create one** to register
2. Go to **Connections** → add a database connection (e.g., the bundled MySQL on host `mysql`, port `3306`, user `root`, password `rootpass`)
3. Go to **Data Browser** → select the connection → pick a table → browse data
4. Edit cells inline, then click **Submit Edits** to save
5. Go to **Submissions** to download extracted JSON/CSV files

### Create an Admin User

```bash
docker compose exec backend python manage.py shell -c "
from accounts.models import User
u = User.objects.get(username='YOUR_USERNAME')
u.role = 'admin'
u.save()
print(f'{u.username} is now admin')
"
```

---

## Project Structure

```
├── backend/
│   ├── accounts/          # User model, auth views, audit log
│   ├── connectors/
│   │   ├── engine/
│   │   │   ├── base.py    # Abstract DatabaseConnector (ABC)
│   │   │   ├── factory.py # ConnectorFactory (dynamic import)
│   │   │   ├── pg.py      # PostgreSQL connector
│   │   │   ├── mysql.py   # MySQL connector
│   │   │   ├── mongo.py   # MongoDB connector
│   │   │   ├── ch.py      # ClickHouse connector
│   │   │   └── oracle.py  # Oracle connector (thin client)
│   │   ├── models.py      # ConnectionConfig model
│   │   └── views.py       # CRUD + test/tables/columns/preview actions
│   ├── submissions/
│   │   ├── models.py      # Submission, SubmissionFile, FileShare models
│   │   └── views.py       # Extract, fetch-and-submit, file download, sharing
│   ├── core/
│   │   ├── settings.py    # Django settings (DB, JWT, CORS, DRF)
│   │   ├── permissions.py # IsAdmin, IsOwnerOrAdmin, IsOwnerOrAdminOrShared
│   │   └── urls.py        # API routing
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── dashboard/
│       │   │   ├── layout.tsx        # Sidebar navigation
│       │   │   ├── page.tsx          # Dashboard with stats cards
│       │   │   ├── connections/      # Connection CRUD
│       │   │   ├── browser/          # Data browser + editable grid
│       │   │   ├── submissions/      # Submissions list + file download
│       │   │   └── admin/            # Admin panel (users + audit log)
│       │   ├── login/page.tsx        # Sign in (split layout)
│       │   └── register/page.tsx     # Registration (split layout)
│       └── lib/
│           ├── api.ts                # Axios client with JWT interceptor
│           ├── auth.tsx              # AuthProvider context
│           └── types.ts              # TypeScript interfaces
├── docker/
│   ├── backend.Dockerfile
│   └── frontend.Dockerfile
├── docker-compose.yml
├── DESIGN.md                         # Design decisions document
└── README.md
```

---

## API Endpoints

### Authentication

| Method | Endpoint                       | Description       |
| ------ | ------------------------------ | ----------------- |
| POST   | `/api/accounts/register/`      | Create account    |
| POST   | `/api/accounts/login/`         | Get JWT tokens    |
| POST   | `/api/accounts/token/refresh/` | Refresh token     |
| GET    | `/api/accounts/me/`            | Current user info |

### Connections

| Method | Endpoint                        | Description         |
| ------ | ------------------------------- | ------------------- |
| GET    | `/api/connectors/`              | List connections    |
| POST   | `/api/connectors/`              | Create connection   |
| POST   | `/api/connectors/{id}/test/`    | Test connectivity   |
| GET    | `/api/connectors/{id}/tables/`  | List tables         |
| GET    | `/api/connectors/{id}/columns/` | Get column metadata |
| GET    | `/api/connectors/{id}/preview/` | Preview table data  |

### Submissions

| Method | Endpoint                                | Description              |
| ------ | --------------------------------------- | ------------------------ |
| GET    | `/api/submissions/`                     | List submissions         |
| POST   | `/api/submissions/extract/`             | Submit edited data       |
| POST   | `/api/submissions/fetch-and-submit/`    | Extract directly from DB |
| GET    | `/api/submissions/files/{id}/download/` | Download file            |
| POST   | `/api/submissions/shares/`              | Share a file             |

---

## Running Tests

```bash
# Backend tests (60 tests)
docker compose exec backend python manage.py test --verbosity=2

# Frontend tests
docker compose exec frontend npx jest --passWithNoTests
```

---

## Adding a New Database Connector

1. Create `backend/connectors/engine/yourdb.py`:

   ```python
   from .base import DatabaseConnector

   class YourDBConnector(DatabaseConnector):
       def connect(self): ...
       def disconnect(self): ...
       def test_connection(self) -> bool: ...
       def get_tables(self) -> list[str]: ...
       def get_columns(self, table) -> list[dict]: ...
       def fetch_data(self, table, limit=100, offset=0) -> list[dict]: ...
       def get_row_count(self, table) -> int: ...
   ```

2. Add to `backend/connectors/engine/factory.py`:
   ```python
   'yourdb': 'connectors.engine.yourdb.YourDBConnector',
   ```
3. Add to `backend/connectors/models.py` `DB_TYPE_CHOICES`
4. Add to `frontend/src/app/dashboard/connections/page.tsx` `DB_TYPES` array

---

## Environment Variables

| Variable               | Default                     | Description                  |
| ---------------------- | --------------------------- | ---------------------------- |
| `DB_NAME`              | `dataconnector`             | App database name            |
| `DB_USER`              | `postgres`                  | App database user            |
| `DB_PASSWORD`          | `postgres`                  | App database password        |
| `DB_HOST`              | `postgres`                  | App database host            |
| `DJANGO_SECRET_KEY`    | (generated)                 | Django secret key            |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000`     | Allowed frontend origins     |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8000/api` | Backend API URL for frontend |

---

## License

This project was built as an assessment submission.
