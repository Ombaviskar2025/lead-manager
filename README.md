# Lead Manager

A small full-stack web app for capturing and tracking sales leads — built for the Meru Technosoft Full Stack Developer screening assignment.

**Stack:** React 19 + Vite (frontend) · Node.js + Express (backend) · SQLite via `better-sqlite3` (database) · JWT auth

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
- Automated API tests (10 tests, Node's built-in test runner + supertest)
- Single-process deploy mode (Express serves the built frontend)

**Extras:** light/dark theme, responsive layout (table turns into cards on phones), toast notifications, loading / empty / error states, debounced search, accessible modals.

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
```

Run the API tests:

```bash
npm test
```

### Configuration
Everything works with zero configuration. To customise, copy `backend/.env.example` to `backend/.env` (port, JWT secret, DB path, CORS). `frontend/.env.example` documents `VITE_API_URL`, only needed if the API is hosted on a different domain. No secrets are committed.

## API

All `/api/leads/*` routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account → `{ user, token }` |
| POST | `/api/auth/login` | Log in → `{ user, token }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/leads` | List. Query: `q`, `status`, `sortBy`, `order`, `page`, `limit` |
| GET | `/api/leads/stats` | `{ total, byStatus }` for the dashboard |
| GET | `/api/leads/:id` | Single lead |
| POST | `/api/leads` | Create |
| PUT | `/api/leads/:id` | Update |
| DELETE | `/api/leads/:id` | Delete (204) |
| GET | `/api/health` | Health check |

Errors are consistent: `{ "error": "message", "details": { "field": "reason" } }` with proper status codes (400 validation, 401 auth, 404 missing/not yours, 409 duplicate email, 500 unexpected).

## Project structure

```
backend/
  src/
    app.js            Express app factory (testable, no side effects)
    server.js         Process entry point
    db.js             Schema + indexes
    config.js         Env config
    routes/           auth.js, leads.js
    middleware/       auth (JWT), errorHandler
    utils/            validation, errors
  tests/api.test.js
frontend/
  src/
    api/              fetch client (token handling, error normalisation)
    context/          Auth + Toast providers
    components/       Table, form modal, confirm dialog, stats, pagination, ...
    pages/            AuthPage, LeadsPage
    utils/            validation, constants
    styles.css        Design tokens, light/dark themes, responsive rules
```

## Technology choices & why

- **Express + SQLite:** the task is small and single-user-per-record; SQLite gives a real relational schema, constraints and indexes with zero setup (a reviewer can run it without installing a database server). `better-sqlite3` is synchronous, fast and simple.
- **React + Vite:** matches the team's stack; Vite gives fast dev and a tiny production bundle. Plain CSS with design tokens keeps the dependency list short (only `react`, `react-dom`, `react-router-dom`).
- **JWT (bcrypt-hashed passwords):** stateless auth that suits a separate SPA + API.

## Database design

- `users(id, name, email UNIQUE NOCASE, password_hash, created_at)`
- `leads(id, user_id → users ON DELETE CASCADE, name, email, phone, company, source, status CHECK IN (...), created_at, updated_at)`
- Indexes on `(user_id, status)`, `(user_id, created_at)`, `(user_id, name)` — every query is scoped by user, so these cover filtering, default sorting and name sorting.

## Assumptions

- "Search by name" also matches email and company — more useful, still satisfies the requirement.
- Source options are a fixed list (Website, Referral, LinkedIn, Cold Call, Email Campaign, Event, Other), defined once in the backend and mirrored in the UI.
- All lead fields are required (the brief lists them without marking any optional).
- Phone accepts digits, spaces, `+`, `-`, `()` with 7–20 characters, so international formats work.
- Duplicate lead emails are allowed (different people at one company may share a mailbox).
- Another user's lead returns 404 (not 403) so IDs can't be probed.

## What I would improve with more time

- Refresh tokens / httpOnly cookies instead of a token in `localStorage`; rate limiting on auth routes
- Frontend component tests (Testing Library) and a Playwright smoke suite in CI
- Migrations tool (e.g. Knex / Drizzle) instead of `CREATE TABLE IF NOT EXISTS`
- Lead notes / activity timeline, CSV import/export, bulk actions
- Server-side full-text search (SQLite FTS5) for large datasets
- Docker setup and a deployed live demo

## What I cut, and why

- Roles/teams, password reset and email verification — out of scope for a screening exercise.
- A deployed link: the repo is deploy-ready (`npm start` serves UI + API on one port, `JWT_SECRET` required in production) but I did not host it.

## Notes

- **Proud of:** the backend is fully tenant-scoped and tested for cross-user isolation; the API has one consistent error shape that the frontend maps straight onto form fields; search/sort use whitelisted columns and escaped `LIKE`, so there's no SQL injection or wildcard surprises.
- **Tricky:** keeping the list responsive under fast typing/clicking — handled with debounced search and a request-id guard so a slow, stale response can never overwrite a newer one; and stepping back a page automatically when the last item on a page is deleted.
