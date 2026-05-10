# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Kupot** is a charity box management system for distributed collection boxes across cities. The project manages:
- **Boxes** (קופות) — Physical collection boxes with serial numbers
- **Cards** (כרטסות) — Active location records for each box
- **Collections & deposits** — Envelope tracking and cash flow
- **Tasks** — Installation, removal, transfer, maintenance
- **Reports & Alerts** — Issue tracking and notifications

The system supports 3 user roles:
- **admin** — Full system access, user/settings management
- **collector** — Field operations (collection, reporting, task execution)
- **cashroom** — Cash room deposits (cash entry, bank reconciliation)

**Approved UI:** [`kupot_wireframe_v10.html`](./kupot_wireframe_v10.html) — All frontend work must match this design exactly.

---

## Architecture

### Tech Stack
- **Backend:** Node.js 18+ + Express.js
- **Database:** PostgreSQL 14+
- **Auth:** JWT (3 roles via token claims)
- **File uploads:** Multer (images → `/uploads` dir)
- **Security:** Helmet, CORS, rate-limiting (login), bcrypt

### Key Directories
```
backend/
├── src/
│   ├── index.js                  Express app setup + route mounting
│   ├── db/
│   │   ├── pool.js               PostgreSQL connection pool
│   │   ├── schema.sql            Tables, triggers, enums (load via db:init)
│   │   └── seed.sql              Demo data (load via db:seed)
│   ├── logic/
│   │   ├── cardLogic.js          Card lifecycle (open/close), task execution
│   │   └── userAssignment.js     Hierarchical area filtering (city → neighborhood → street)
│   ├── middleware/
│   │   ├── auth.js               JWT verify + user context injection
│   │   ├── roles.js              Role-based endpoint gating
│   │   └── upload.js             Multer file handling
│   ├── routes/                   11 REST route files (below)
│   └── utils/
│       └── csv.js                CSV export helpers
├── scripts/
│   ├── runSql.js                 Execute .sql files (used by db:init/seed)
│   └── seedUsers.js              Create demo users
├── tests/
│   ├── unit/                     No-DB tests (jest)
│   └── integration/              DB tests (RUN_DB_TESTS=true)
└── uploads/                      Runtime: uploaded images stored here
```

---

## Database Schema Overview

**Core Tables:**
- `users` — Credentials, role, area assignments (JSONB), exclusions (JSONB), active flag
- `boxes` — Physical boxes: iron_number (unique), status (uninstalled/active/inactive)
- `cards` — Location records: one active per box, stores full address + custom fields
- `envelopes` — Collection records: ref to card, seq, amount, status (pending/entered)
- `events` — Immutable log: card ID, event_type, timestamp, user, image
- `tasks` — Work orders: box ID, task_type, status (pending/assigned/done/cancelled)
- `reports` — User-submitted issues: card/box ref, status, assigned_to
- `task_types` — Lookup: name, icon, flags (opens_card, closes_card)
- `report_types` — Lookup: name, icon
- `settings` — Global config: key/value pairs (e.g. `alert_days_global`)

**Schema loaded from:** [`backend/src/db/schema.sql`](./backend/src/db/schema.sql)

---

## Critical Business Logic

### Card Lifecycle (cardLogic.js)
Cards are **location records** for boxes. One box can have many cards over time (sequential).

- **`openCard(boxId, location, userId, client, eventType)`** — Create active card with address + collector assignment. Auto-creates event.
  - Validates: cannot open if active card exists for this box.
  - Event types: `INSTALLATION`, `TRANSFER_OPEN`

- **`closeCard(cardId, reason, userId, client, eventType)`** — Mark closed, auto-creates event.
  - Event types: `REMOVAL`, `TRANSFER_CLOSE`

- **`getActiveCard(boxId)`** — Fetch current active card for box (or null).

- **`completeTask(taskId, executionData, userId)`** — Execute task with automatic card lifecycle.
  - If `task.opens_card && task.closes_card` → **transfer**: close active card + open new one (2 events)
  - If `task.opens_card` → **installation**: open card (1 event)
  - If `task.closes_card` → **removal**: close active card (1 event)
  - Otherwise → add `TASK_DONE` event to active card (if exists)
  - **Requires location data (city) for opens_card tasks** (unless admin overrides)
  - All operations in transaction; rolls back on error.

### User Assignment (userAssignment.js)
Hierarchical assignment + exclusion at 4 levels:

```json
area_assignments: [
  { type: 'city',         value: 'בני ברק' },
  { type: 'neighborhood', city: 'בני ברק', value: 'רמת אלחנן' },
  { type: 'street',       city: '...', neighborhood: '...', value: 'חזון איש' },
  { type: 'box',          box_id: 42 }
]
```

- **`getBoxesForCollector(userId)`** — Returns active cards visible to user (SQL WHERE clause built from assignments + exclusions).
- Assignment logic: union of OR'd rules (collector sees any matching box).
- Exclusion logic: AND'd rules (excluded box is hidden).
- Built as SQL WHERE fragments to filter at DB level (no in-app filtering).

### Alerts
- **Trigger:** Active card with no collection event in X days.
- **X = personal alert_days (card.alert_days_personal) OR global setting (`settings.alert_days_global`, default 30)**.
- Cards auto-assigned to collector (card.collector_id) if set.

---

## API Routes (11 endpoints, all under `/api`)

| Route | File | Key Endpoints |
|-------|------|---|
| `/auth` | [`routes/auth.js`](./backend/src/routes/auth.js) | `POST /login`, `GET /me`, `POST /logout` |
| `/boxes` | [`routes/boxes.js`](./backend/src/routes/boxes.js) | `GET /` (list), `POST /` (create), `PATCH /:id` (update status) |
| `/cards` | [`routes/cards.js`](./backend/src/routes/cards.js) | `GET /` (by box), `GET /active` (for collector), `PATCH /:id` (update fields) |
| `/envelopes` | [`routes/envelopes.js`](./backend/src/routes/envelopes.js) | `POST /` (record collection), `PATCH /:id/cash-entry` (cashroom deposit) |
| `/events` | [`routes/events.js`](./backend/src/routes/events.js) | `GET /` (card log), `POST /` (manual log entry, admin only) |
| `/tasks` | [`routes/tasks.js`](./backend/src/routes/tasks.js) | `GET /`, `POST /`, `PATCH /:id/execute` (trigger cardLogic) |
| `/reports` | [`routes/reports.js`](./backend/src/routes/reports.js) | `GET /`, `POST /`, `PATCH /:id/convert-to-task` |
| `/users` | [`routes/users.js`](./backend/src/routes/users.js) | `GET /`, `POST /` (create, admin only), `PATCH /:id` (update role/assignments) |
| `/alerts` | [`routes/alerts.js`](./backend/src/routes/alerts.js) | `GET /` (overdue cards for logged-in user) |
| `/uploads` | [`routes/uploads.js`](./backend/src/routes/uploads.js) | `POST /` (file upload), `GET /:filename` (static serve) |
| `/reports-export` | [`routes/reportsExport.js`](./backend/src/routes/reportsExport.js) | `GET /` (CSV export of reports) |
| `/settings` | [`routes/settings.js`](./backend/src/routes/settings.js) | `GET /`, `PATCH /` (admin only) |

**Auth:** All routes except `POST /api/auth/login` require `Authorization: Bearer <jwt-token>`.

**Middleware:** Inject `req.user` (from JWT) + role checks via `requireRole()`.

---

## Common Development Commands

### Backend Setup & Running

```bash
cd backend

# Install deps
npm install

# Create empty database
psql -U postgres -c "CREATE DATABASE kupot_db;"

# Load schema + seed demo data
npm run db:init
npm run db:seed

# Run server
npm start          # production (no restart)
npm run dev        # development (nodemon auto-restart)

# Server listens on http://localhost:3000
```

### Testing

```bash
# Unit tests (no DB needed)
npm test

# Unit + Integration tests (requires DB, RUN_DB_TESTS=true)
RUN_DB_TESTS=true npm test

# Watch mode
npm run test:watch
```

**Test structure:**
- `tests/unit/` — cardLogic, csv, userAssignment (no DB)
- `tests/integration/` — auth, cardLogic with transactions (DB required)
- `tests/integration/_helpers.js` — Test utilities (user creation, pool helpers)

### Database Scripting

```bash
# Execute arbitrary SQL
node scripts/runSql.js <path-to-sql-file>

# Re-seed demo users
node scripts/seedUsers.js

# Load schema from scratch
npm run db:init   # = node scripts/runSql.js src/db/schema.sql

# Load demo data
npm run db:seed   # = seedUsers.js + seed.sql
```

---

## Configuration (.env)

See [`backend/.env.example`](./backend/.env.example) for all vars. Key ones:

- `PORT` — Server port (default 3000)
- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME` — PostgreSQL credentials
- `JWT_SECRET` — Secret for signing JWTs (generate random string for prod)
- `JWT_EXPIRES_IN` — Token lifetime (default `7d`)
- `NODE_ENV` — `development` or `production` (affects error messages, logging)
- `CORS_ORIGIN` — Comma-separated origins or `*` (demo only)
- `UPLOAD_DIR` — Where to store images (default `./uploads`)
- `DEMO_PASSWORD` — Password for seeded demo users

---

## Key Implementation Patterns

### Authentication & Authorization
- Login: `POST /api/auth/login` returns JWT with `{id, role}`.
- Every other request: `authenticate` middleware verifies JWT + injects `req.user`.
- Role gating: `requireRole('admin')` middleware on admin-only endpoints.
- **Time-constant login:** Uses dummy hash compare to prevent username enumeration.

### Card Lifecycle in Tasks
- Task completion calls `completeTask()` which:
  1. Fetches task + task_type (opens_card, closes_card flags)
  2. Validates location for opens_card tasks
  3. Closes/opens cards based on task flags
  4. Updates box status (active/inactive)
  5. Creates events for audit trail
  6. All in transaction (ROLLBACK on error)

### User Visibility Filtering
- Collectors see only their assigned boxes (via area rules).
- Built at SQL query level (not app-level filtering).
- `getBoxesForCollector()` returns WHERE clause from JSONB rules.
- Admin sees all.

### File Uploads
- `Multer` middleware in [`middleware/upload.js`](./backend/src/middleware/upload.js).
- Uploads stored in `./uploads/` (configurable via `UPLOAD_DIR`).
- Accessible via `GET /uploads/:filename` (static middleware in index.js).
- Used for task execution images, event photos, etc.

### Error Handling
- Centralized error handler in `index.js` (last middleware).
- Dev: returns actual error message.
- Production: returns generic "Internal server error".
- All DB queries wrapped in try/catch + `next(err)` to handler.

---

## Frontend Apps

```
frontend-admin/      Admin web panel (Vite + React 18 + react-router-dom)
                     Used by admin and cashroom roles.
                     Dev: `npm run dev` (vite, port 5173, proxies /api → :3000)
                     Prod: `npm run build` → dist/  (served via vite preview :5000)

frontend-collector/  Field-collector mobile-style app (Vite + React 19 + Capacitor)
                     Wraps to Android APK via @capacitor/android. Also runs in browser.
                     Barcode scanning via @zxing/browser.
                     Dev: vite port 5174, proxies /api → :3000
                     Prod: `npm run build` → dist/  (served via vite preview :5001)
```

**Shared code:** Files used by both frontends live in [`frontend-shared/src/`](./frontend-shared/src/)
and are imported via Vite aliases:
- `@shared/...` → `frontend-shared/src/...` (cross-frontend code)
- `@app-api/...` → `<this-frontend>/src/api/...` (per-frontend; lets shared modules import the local `endpoints`)

Currently shared: `api/client.js`, `context/AuthContext.jsx`, `components/ProtectedRoute.jsx`,
`components/Modal.jsx`, `components/CloseReportModal.jsx`, `utils/cardLabel.js`.

`endpoints.js` stays per-frontend because the collector needs an extra `lookupByIron` route
the admin doesn't. When adding a new shared file, drop it under `frontend-shared/src/` and
import it from each frontend with `@shared/...`.

**API base URL:** Read from `VITE_API_BASE` at build time (`.env.production` per app).
In dev it falls back to `/api` so the Vite proxy forwards to the local backend.

**UI Spec:** All interfaces must match [`kupot_wireframe_v10.html`](./kupot_wireframe_v10.html) exactly.

---

## זרימות עסקיות עיקריות

### גביה (collector)
1. גובה בוחר קופה → מזין מספר מעטפה (סריקת ברקוד או הזנה ידנית).
2. אופציונלי: מדפיס מדבקה.
3. אישור → נוצר אירוע גביה (`COLLECTION`) על הכרטסת הפעילה, מעטפה נכנסת בסטטוס `pending`.

### הזנת סכום (cashroom)
1. סריקה / הזנה ידנית של מספר מעטפה.
2. מוצגים פרטי הקופה + הכרטסת.
3. הזנת סכום → אישור → המעטפה עוברת ל-`entered`.

### דיווח → משימה
1. גובה מדווח על בעיה (`reports`).
2. מנהל רואה את הדיווח ב-`AlertsPage` / `DochotPage`.
3. המרה למשימה (`POST /api/reports/:id/convert-to-task`) — תוכן הדיווח מועתק אוטומטית.
4. בחירה אם לסגור את הדיווח המקורי או להשאירו פתוח לצורך מעקב.

---

## Testing Strategy

### Unit Tests (no DB)
- **cardLogic.test.js** — Card open/close logic, task execution (mocked pool)
- **csv.test.js** — Report export formatting
- **userAssignment.test.js** — Assignment rule SQL building (no DB calls)

### Integration Tests (DB required)
- **auth.test.js** — Login flow, token validation
- **cardLogic.test.js** — Full card lifecycle with real DB transactions

**Run integration tests:**
```bash
RUN_DB_TESTS=true npm test
```

---

## Security Notes

### Current (Development)
- ✅ Helmet headers enabled
- ✅ CORS configurable
- ✅ Rate-limiting on login (10/min per IP)
- ✅ Bcrypt password hashing
- ✅ JWT token expiry (default 7d)
- ✅ Time-constant login comparison
- ✅ Role-based endpoint protection

### Pre-Production Hardening Checklist
- [ ] `JWT_SECRET` → strong random string (not placeholder)
- [ ] `NODE_ENV=production` (hides error details)
- [ ] `CORS_ORIGIN` → specific domain (not `*`)
- [ ] Delete or rotate demo users
- [ ] Enable HTTPS (proxy/load balancer)
- [ ] Hook external logging (Sentry, Datadog)
- [ ] DB backups + replication
- [ ] Review rate-limiting thresholds
- [ ] Audit file upload validation (malware scanning?)

---

## Context References

- **UI design:** [`kupot_wireframe_v10.html`](./kupot_wireframe_v10.html)
- **Deployment:** [`DEPLOY.md`](./DEPLOY.md)
- **Active task list:** [`TASKS.md`](./TASKS.md), [`TASKS_COLLECTOR.md`](./TASKS_COLLECTOR.md)
