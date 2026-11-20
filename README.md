# Lead Manager

A small full-stack web app for capturing and tracking sales leads — built for the Meru Technosoft Full Stack Developer screening assignment.

**Stack:** React 19 + Vite (frontend) · Node.js + Express (backend) · SQLite via `sql.js` (database) · HttpOnly-cookie sessions (JWT)

- **Live demo:** _add your URL here after deploying (see [Deployment](#deployment))_
- **Repository:** _add your GitHub URL here after pushing (see [Submitting](#submitting-to-github))_

## Features

**Core (all required items)**
- Add a lead: name, email, phone, company, source (dropdown), status (New / Contacted / Qualified / Lost)
- Table of all leads with colour-coded status badges
- Edit a lead and update its status
- Delete with a confirmation dialog
- Search by name (also matches email / company) and filter by status
- Validation on both frontend (instant inline errors) and backend (authoritative, field-level errors)

**Bonus (all attempted)**
- Signup / login — every user sees only their own leads (enforced in every SQL query)
- Sorting (click any column header) and pagination (10 / 25 / 50 per page)
- Dashboard cards with total + per-status counts (click a card to filter)
- Automated tests: **42 backend** (API, security, persistence, migrations) and **49 frontend** (validation, forms, auth, add/edit/delete flows)
- Deployment-ready: single-process mode, Dockerfile and a Render blueprint (see [Deployment](#deployment) — not yet deployed)

**Extras:** light/dark theme, responsive layout (table turns into cards on phones), toast notifications, loading / empty / error states, debounced search, accessible modals, demo-data seed script, backup script.

## Run locally

Requires **Node.js 18+** (tested on Node 22).

```bash
# 1. install everything (root + backend + frontend)
npm run install:all

# 2a. development: API on :5000, web on :5173 with hot reload
npm run dev
#    -> open http://localhost:5173

# 2b. OR production-style: build the UI and serve everything from :5000
npm start
#    -> open http://localhost:5000

# optional: load a demo account with 12 sample leads  (demo@example.com / demo12345)
npm run seed
```

### Tests

```bash
npm test                 # backend + frontend
npm run test:backend     # Node's built-in test runner + supertest
npm run test:frontend    # Vitest + React Testing Library (jsdom)
```

What is covered:

| Area | Examples |
|---|---|
| API validation | every invalid create/update payload → 400 with per-field errors; malformed ids; oversized bodies; non-string input |
| CRUD & queries | full create/read/update/delete, search + filter + sort + pagination (incl. out-of-range pages), stats, SQL-injection strings stored literally |
| Auth & security | HttpOnly cookie set/cleared, tampered/expired/forged tokens, deleted accounts, hashed passwords, rate limiting (429), security headers, production config guard |
| Multi-user isolation | users cannot read, update or delete each other's leads (404) |
| Database | persistence across close/reopen, auto-flush, atomic save, foreign keys still enforced after saving, cascade delete, CHECK/UNIQUE constraints, migrations (fresh, re-open, upgrade from v0, refuse newer), backup script |
| Frontend | validation rules, login / signup (incl. server errors), session restore, lead form (add/edit, server field errors), confirm-before-delete, search/filter/sort/pagination requests, empty / error / retry states |

### Configuration
Everything works with zero configuration in development. Copy `backend/.env.example` to `backend/.env` to customise; it documents every variable (port, `JWT_SECRET`, DB path, cookie and rate-limit settings). `frontend/.env.example` documents `VITE_API_URL`, only needed if the API is on a different domain. No secrets are committed.

## API

Authenticated routes accept the session cookie (browser) or `Authorization: Bearer <token>` (API clients).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account, start session (rate limited) |
| POST | `/api/auth/login` | Log in, start session (rate limited) |
| POST | `/api/auth/logout` | End session (clears cookie) |
| GET | `/api/auth/session` | `{ user }` or `{ user: null }` — always 200, used on page load |
| GET | `/api/auth/me` | Current user (401 if signed out) |
| GET | `/api/leads` | List. Query: `q`, `status`, `sortBy`, `order`, `page`, `limit` |
| GET | `/api/leads/stats` | `{ total, byStatus }` for the dashboard |
| GET | `/api/leads/:id` | Single lead |
| POST | `/api/leads` | Create |
| PUT | `/api/leads/:id` | Update |
| DELETE | `/api/leads/:id` | Delete (204) |
| GET | `/api/health` | Health check |

Errors are consistent: `{ "error": "message", "details": { "field": "reason" } }` with proper status codes (400 validation, 401 auth, 404 missing/not yours, 409 duplicate email, 413 too large, 429 rate limited, 500 unexpected).

## Project structure

```
backend/
  src/
    app.js            Express app factory (testable, no side effects)
    server.js         Process entry point
    db.js             sql.js wrapper: prepare/get/all/run, atomic persistence
    migrations.js     Versioned schema migrations (PRAGMA user_version)
    config.js         Env config + production safety checks
    routes/           auth.js, leads.js
    middleware/       auth (cookie/JWT), errorHandler
    utils/            validation, errors
  scripts/            backup.js, seed.js
  tests/              api, edge cases, auth/security, database
frontend/
  src/
    api/              fetch client (cookie session, error normalisation)
    context/          Auth + Toast providers
    components/       Table, form modal, confirm dialog, stats, pagination, ...
    pages/            AuthPage, LeadsPage
    utils/            validation, constants
    test/             shared test helpers
    styles.css        Design tokens, light/dark themes, responsive rules
Dockerfile, render.yaml
```

## Technology choices & why

- **Express + SQLite:** every record belongs to one user, so a relational schema with constraints and indexes fits, and SQLite needs no database server. I used `sql.js` (SQLite compiled to WebAssembly) instead of a native driver so `npm install` never needs a C++ toolchain or prebuilt binaries and behaves identically on Windows, macOS and Linux. A thin wrapper in `db.js` exposes a `prepare().get/all/run` API and writes the database file atomically (debounced) after changes. For heavier production use I would move to PostgreSQL (see below).
- **React + Vite:** matches the team's stack; tiny production bundle. Plain CSS with design tokens keeps dependencies to `react`, `react-dom`, `react-router-dom`.
- **HttpOnly cookie sessions:** the JWT is stored in an `HttpOnly; Secure; SameSite=Lax` cookie, so injected scripts cannot read it (unlike `localStorage`). `SameSite=Lax` plus JSON-only bodies protects against cross-site request forgery.

## Security

- Session token in an HttpOnly cookie (`Secure` automatically in production), 7-day expiry, cleared on logout
- Rate limiting on login/signup (default 20 attempts / 15 min / IP; configurable)
- Passwords hashed with bcrypt; responses never include hashes
- `helmet` headers including a Content-Security-Policy; `x-powered-by` removed
- Production refuses to start without a `JWT_SECRET` of 32+ characters; the secret only ever comes from the environment
- Parameterised SQL everywhere, whitelisted sort columns, escaped `LIKE`, 100 KB body limit
- Every lead query is scoped to the signed-in user; other users' IDs return 404

Known limitation: there is no CSRF token; protection relies on `SameSite=Lax` cookies and strict JSON parsing, which is adequate for a same-origin app. If the UI is ever hosted on a different site, add CSRF tokens.

## Database

- `users(id, name, email UNIQUE NOCASE, password_hash, created_at)`
- `leads(id, user_id → users ON DELETE CASCADE, name, email, phone, company, source, status CHECK IN (...), created_at, updated_at)`
- Indexes on `(user_id, status)`, `(user_id, created_at)`, `(user_id, name)` — every query is scoped by user, so these cover filtering, default sorting and name sorting.

### Migrations
The schema version lives inside the database file (`PRAGMA user_version`). On startup every pending migration in `backend/src/migrations.js` runs in order, each in a transaction (rolled back on failure). To change the schema, **append** a new `{ version, name, sql }` entry — never edit an old one. A database from a newer app version is refused rather than corrupted.

### Backup and recovery
```bash
npm run backup                       # copies the DB to <db folder>/backups/leads-<timestamp>.db
cd backend && npm run backup -- --keep 14   # keep the 14 newest (default 10)
```
- The server only ever replaces the database file atomically (temp file + rename), so a backup taken while it runs is always a complete database.
- **Restore:** stop the server → copy a backup file over `DB_PATH` (default `backend/data/leads.db`) → start the server (migrations bring it up to date).
- In production, schedule `npm run backup` (cron / platform scheduled job) **and** copy backups off the server, or use your host's disk snapshots. A backup on the same disk does not protect against losing the disk.

### PostgreSQL for production
SQLite on a single disk is fine for this scale (one server process). If you need multiple app instances, zero-downtime deploys, or managed backups/point-in-time recovery, move to PostgreSQL: the data layer is isolated in `db.js` + the two route files, the SQL is standard apart from `datetime('now')`, `AUTOINCREMENT` and `PRAGMA`, and the migrations file is the natural place to port the schema.

## Deployment

The app deploys as **one service** (Express serves the API and the built UI), so there are no CORS or cross-site cookie issues.

> **Status:** deployment config is included but the app is **not deployed** by me — hosting needs your own account. Follow the steps below, then paste the URL at the top of this README.

**Important:** SQLite needs a **persistent disk**. Free tiers with an ephemeral filesystem (including Render's free web service) wipe the database on every restart/redeploy. Use a host that offers volumes/disks (typically a paid instance) and point `DB_PATH` at it.

### Option A — Render (blueprint included)
1. Push the repo to GitHub.
2. Render dashboard → **New → Blueprint** → select the repo. `render.yaml` creates a Docker web service with a 1 GB persistent disk at `/data` and generates a strong `JWT_SECRET`.
3. After the first deploy, open the URL and sign up (or run `npm run seed` in the Render shell for demo data).
4. **Verify persistence:** add a lead → Render dashboard → **Manual Deploy → Deploy latest commit** (or restart) → log in again; the lead must still be there.

### Option B — Railway / Fly.io / any Docker host
Build the included `Dockerfile`, attach a volume mounted at `/data`, and set these variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` (set by the Dockerfile) |
| `JWT_SECRET` | random 32+ chars: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DB_PATH` | `/data/leads.db` (set by the Dockerfile — must be on the volume) |
| `TRUST_PROXY` | `1` (set by the Dockerfile) so rate limiting sees real client IPs |

### Option C — a plain VM
`npm run install:all && npm start` behind nginx/Caddy with HTTPS, with `NODE_ENV=production` and `JWT_SECRET` set; schedule `npm run backup`.

> The `Dockerfile` and `render.yaml` were written carefully but I could not build the image in my environment (no Docker daemon). I verified the same steps by hand: `npm ci`, frontend build, `npm ci --omit=dev` for the backend, then starting in production mode and exercising the app in a real browser.

## Submitting to GitHub

```bash
# create an EMPTY public repo on github.com first (no README/license), then:
git remote add origin https://github.com/<your-username>/lead-manager.git
git branch -M main
git push -u origin main
```
The commit history is already included. Before pushing, set your own identity so commits carry your name: `git config user.name "Your Name"` and `git config user.email "you@example.com"` (existing commits keep the placeholder author; to rewrite them use `git rebase -r --root --exec 'git commit --amend --no-edit --reset-author'`). Then add the repo and live-demo URLs at the top of this README and reply to the email with the link.

## Assumptions

- "Search by name" also matches email and company — more useful, still satisfies the requirement.
- Source options are a fixed list (Website, Referral, LinkedIn, Cold Call, Email Campaign, Event, Other), defined once in the backend and mirrored in the UI.
- All lead fields are required (the brief lists them without marking any optional).
- Phone accepts digits, spaces, `+`, `-`, `()` with 7–20 characters, so international formats work.
- Duplicate lead emails are allowed (different people at one company may share a mailbox).
- Another user's lead returns 404 (not 403) so IDs can't be probed.

## What I would improve with more time

- PostgreSQL + a real migration tool (Knex / Drizzle) once more than one instance is needed
- CSRF tokens, refresh-token rotation, password reset and email verification
- Playwright browser tests in CI (I ran an end-to-end browser pass manually, but it is not part of the repo)
- Lead notes / activity timeline, CSV import/export, bulk actions
- Server-side full-text search (SQLite FTS5 / Postgres) for large datasets
- Automated off-site backups

## What I cut, and why

- Roles/teams, password reset and email verification — out of scope for a screening exercise.
- An actual hosted deployment — requires the applicant's own hosting account; config and instructions are included.

## Notes

- **Proud of:** the backend is fully tenant-scoped and tested for cross-user isolation; the API has one consistent error shape that the frontend maps straight onto form fields; the session is an HttpOnly cookie rather than a script-readable token; and the database layer has versioned migrations and tests proving data survives restarts.
- **Tricky:** keeping the list responsive under fast typing/clicking — handled with debounced search and a request-id guard so a slow, stale response can never overwrite a newer one; stepping back a page automatically when the last item on a page is deleted; and making `sql.js` behave like a durable database (atomic writes, and re-applying `foreign_keys` after every export, which silently resets it).
