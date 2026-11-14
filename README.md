# CAPTANHUNG — GPS-Verified Event Attendance Management Platform

A production-ready, mobile-first event attendance management platform with GPS-verified check-in/check-out, photo evidence, administrator authentication, role-based access control, reporting/exports, and full audit logging.

## Architecture

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **API:** Next.js route handlers (server-side)
- **Database:** PostgreSQL, accessed via [Drizzle ORM](https://orm.drizzle.team/) + `pg`
- **Auth:** Argon2id password hashing, JWT access + refresh tokens (HttpOnly cookies), CSRF-aware same-site cookies, role-based permissions
- **File storage:** Private local disk storage by default; optional S3-compatible object storage
- **Deploy:** Frontend on Vercel, backend as server-side API, PostgreSQL database

## Project structure

```
src/app/              Next.js App Router pages & API routes
src/app/api/          Backend API (public + admin)
src/app/api/auth/     Login, logout, refresh
src/app/api/events/   Public event listing & event config
src/app/api/events/[code]/check-in | check-out  GPS-verified attendance
src/app/api/admin/    Admin dashboard, events, attendance, reports, users, audit
src/db/               Drizzle schema, connection, repository layer
src/lib/              Auth, GPS/haversine, storage, API client
database/migrations/  PostgreSQL migration SQL (001_init.sql)
scripts/seed.ts       Seed roles, permissions, default admin
```

## API summary

Public:
- `GET /api/events` — list open/upcoming events
- `GET /api/events/{code}` — event config by code (no secrets)
- `POST /api/events/{code}/check-in` — GPS-verified check-in (JSON)
- `POST /api/events/{code}/check-out` — GPS-verified check-out + photo (multipart)
- `GET /api/attendance/{reference}` — attendance record lookup

Admin (require authentication + permissions):
- `POST /api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`
- `GET/POST /api/admin/events`, `GET/PATCH /api/admin/events/{id}`
- `POST /api/admin/events/{id}/publish|open|pause|close|reopen`
- `GET /api/admin/events/{id}/attendance`
- `GET/PATCH /api/admin/attendance/{id}`
- `GET /api/admin/reports`, `GET /api/admin/reports/export` (csv/xlsx/pdf)
- `GET /api/admin/evidence?key=...` — private evidence (authorized)
- `GET/POST /api/admin/users`, `GET /api/admin/users/{id}`
- `GET /api/admin/roles`, `GET /api/admin/permissions`, `GET /api/admin/audit-logs`, `GET /api/admin/dashboard`

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Required at minimum:
- `DATABASE_URL` — PostgreSQL connection string
- `ACCESS_TOKEN_SECRET` — random secret
- `REFRESH_TOKEN_SECRET` — random secret

### 3. Database

A PostgreSQL database is required. For local development you can use Docker Compose:

```bash
docker compose up -d
```

Then apply the migration:

```bash
psql $DATABASE_URL -f database/migrations/001_init.sql
```

Or generate/apply with Drizzle Kit:

```bash
npm run db:generate
npm run db:push
```

### 4. Seed default roles, permissions, and admin user

```bash
SEED_ADMIN_EMAIL=admin@captanhung.local SEED_ADMIN_PASSWORD=Admin@123456 npm run db:seed
```

Change the default admin password in production.

### 5. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`. Admin: `http://localhost:3000/admin-login`.

### 6. Build & start

```bash
npm run build
npm run start
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Drizzle migration files |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed roles, permissions, admin |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run lint` | Run ESLint |

## Environment variables

See `.env.example`. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ACCESS_TOKEN_SECRET` | JWT access token secret |
| `REFRESH_TOKEN_SECRET` | JWT refresh token secret |
| `ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime (default 900) |
| `REFRESH_TOKEN_TTL_SECONDS` | Refresh token lifetime (default 604800) |
| `UPLOAD_LIMIT_BYTES` | Max upload size (default 10485760 = 10 MB) |
| `EVIDENCE_STORAGE_PATH` | Local evidence dir (default ./evidence) |
| `S3_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY` | Optional S3-compatible storage |
| `SEED_ADMIN_EMAIL/PASSWORD` | Default admin credentials |

## Security

- Passwords hashed with Argon2id (never plaintext)
- Admin APIs never exposed to unauthenticated users
- Evidence stored privately, served via authorized short-lived proxy (`/api/admin/evidence?key=...`)
- No secrets exposed to the frontend
- GPS/geofence validated independently on the backend
- Idempotency keys for check-in/check-out
- Full audit logging of actor actions
- Rate limiting and login-attempt protection recommended at the ingress/proxy layer

## GPS / geofence

The backend validates captured coordinates using the Haversine formula against the configured event location and radius. GPS accuracy must be within the configured threshold (default 20 m). Readings are checked for freshness. Browser GPS cannot guarantee protection against location spoofing; the platform distinguishes verified readings from confirmed physical presence and flags suspicious submissions for admin review.

## Deployment

Recommended:
- Frontend + API: Vercel (serverless functions)
- Database: Managed PostgreSQL
- Evidence storage: S3-compatible bucket (or persistent disk for single-node)

Set all secrets via environment variables on the deployment platform. Run `database/migrations/001_init.sql` against the production database before first deploy.
