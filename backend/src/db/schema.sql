-- Kupot Project — PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
--  TRIGGER FUNCTIONS
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────
--  LOOKUP TABLES
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS box_types (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS task_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  icon        VARCHAR(50),
  opens_card  BOOLEAN NOT NULL DEFAULT FALSE,
  closes_card BOOLEAN NOT NULL DEFAULT FALSE,
  -- when TRUE, an open/in-progress task of this type grants the assigned
  -- collector temporary access to the box (overriding area assignments).
  grants_temporary_access BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS report_types (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE,
  icon  VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

-- ─────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  username          VARCHAR(100) NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  role              VARCHAR(20)  NOT NULL CHECK (role IN ('admin','collector','cashroom')),
  area_assignments  JSONB NOT NULL DEFAULT '[]',
  area_exclusions   JSONB NOT NULL DEFAULT '[]',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  BOXES
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS boxes (
  id            SERIAL PRIMARY KEY,
  iron_number   VARCHAR(50) NOT NULL UNIQUE,
  box_type_id   INTEGER REFERENCES box_types(id) ON DELETE RESTRICT,
  status        VARCHAR(20) NOT NULL DEFAULT 'uninstalled'
                  CHECK (status IN ('uninstalled','active','inactive','unusable')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  CARDS  (כרטסות)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cards (
  id                    SERIAL PRIMARY KEY,
  box_id                INTEGER NOT NULL REFERENCES boxes(id) ON DELETE RESTRICT,
  -- location
  city                  VARCHAR(100),
  neighborhood          VARCHAR(100),
  street                VARCHAR(150),
  building              VARCHAR(50),
  location_notes        TEXT,
  -- assignment
  collector_id          INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  custom_name           VARCHAR(150),
  -- alerts
  alert_days_personal   INTEGER,
  -- receipt
  receipt_required      BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_details       TEXT,
  -- lifecycle
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','closed')),
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at             TIMESTAMPTZ,
  closed_reason         TEXT
);

CREATE INDEX IF NOT EXISTS idx_cards_box_id    ON cards(box_id);
CREATE INDEX IF NOT EXISTS idx_cards_status    ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_collector ON cards(collector_id);
CREATE INDEX IF NOT EXISTS idx_cards_city      ON cards(city);

-- enforce: only one active card per box
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_card_per_box
  ON cards(box_id) WHERE status = 'active';

-- ─────────────────────────────────────────
--  ENVELOPES  (מעטפות)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS envelopes (
  id              SERIAL PRIMARY KEY,
  card_id         INTEGER NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  envelope_number VARCHAR(50) NOT NULL UNIQUE,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_by    INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  amount          NUMERIC(10,2),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','entered')),
  entered_at      TIMESTAMPTZ,
  entered_by      INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_envelopes_card_id      ON envelopes(card_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_status       ON envelopes(status);
CREATE INDEX IF NOT EXISTS idx_envelopes_collected_at ON envelopes(collected_at);

-- ─────────────────────────────────────────
--  EVENTS  (אירועים)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  card_id     INTEGER NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  event_type  VARCHAR(50) NOT NULL,
  description TEXT,
  user_id     INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  image_path  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_card_id    ON events(card_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- ─────────────────────────────────────────
--  TASKS  (משימות)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id                SERIAL PRIMARY KEY,
  box_id            INTEGER NOT NULL REFERENCES boxes(id) ON DELETE RESTRICT,
  card_id           INTEGER REFERENCES cards(id) ON DELETE RESTRICT,
  task_type_id      INTEGER NOT NULL REFERENCES task_types(id) ON DELETE RESTRICT,
  status            VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','in_progress','done','cancelled','not_executed')),
  assigned_to       INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  created_by        INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  notes             TEXT,
  image_path        TEXT,
  execution_notes   TEXT,
  execution_image   TEXT,
  executed_at       TIMESTAMPTZ,
  cancellation_reason  TEXT,
  not_executed_reason  TEXT,
  -- for installation tasks
  new_city          VARCHAR(100),
  new_neighborhood  VARCHAR(100),
  new_street        VARCHAR(150),
  new_building      VARCHAR(50),
  new_location_notes TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_box_id  ON tasks(box_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);

-- ─────────────────────────────────────────
--  REPORTS  (דיווחים)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id              SERIAL PRIMARY KEY,
  card_id         INTEGER NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  report_type_id  INTEGER REFERENCES report_types(id) ON DELETE RESTRICT,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','converted','closed')),
  reported_by     INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  image_path      TEXT,
  task_id         INTEGER REFERENCES tasks(id) ON DELETE RESTRICT,
  closure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_card_id ON reports(card_id);
CREATE INDEX IF NOT EXISTS idx_reports_status  ON reports(status);

-- auto-update updated_at on every row update
DROP TRIGGER IF EXISTS set_reports_updated_at ON reports;
CREATE TRIGGER set_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────
--  IDEMPOTENT MIGRATIONS
--  (re-runs safely on existing DBs; CREATE TABLE IF NOT EXISTS above
--   skips on existing tables so CHECK constraints need explicit refresh)
-- ─────────────────────────────────────────

-- boxes.status: add 'unusable' to allowed set
ALTER TABLE boxes DROP CONSTRAINT IF EXISTS boxes_status_check;
ALTER TABLE boxes ADD  CONSTRAINT boxes_status_check
  CHECK (status IN ('uninstalled','active','inactive','unusable'));

-- tasks.image_path: optional image attached at task creation (admin)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_path TEXT;

-- task_types.grants_temporary_access: flag for one-off collection tasks
-- that grant the assigned collector temporary access to the box.
ALTER TABLE task_types ADD COLUMN IF NOT EXISTS grants_temporary_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed the built-in 'גביה' task type (idempotent). Marked as
-- grants_temporary_access=TRUE so an open task of this type lets the
-- assigned collector see the box even if it isn't in their area.
INSERT INTO task_types (name, icon, opens_card, closes_card, grants_temporary_access)
VALUES ('גביה', '💰', FALSE, FALSE, TRUE)
ON CONFLICT (name) DO UPDATE
  SET grants_temporary_access = EXCLUDED.grants_temporary_access;

-- tasks.cancellation_reason: optional admin-supplied reason captured when a
-- task is cancelled via POST /api/tasks/:id/cancel.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- reports.closure_reason: optional admin-supplied reason captured when a
-- report is closed via POST /api/reports/:id/close (without converting to task).
ALTER TABLE reports ADD COLUMN IF NOT EXISTS closure_reason TEXT;

-- Task 46: collectors can close a task as 'not_executed' with a free-text reason.
-- Refresh the status CHECK constraint and add the reason column (idempotent).
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD  CONSTRAINT tasks_status_check
  CHECK (status IN ('open','in_progress','done','cancelled','not_executed'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS not_executed_reason TEXT;

-- Task 58: server-side geocoding of card addresses (Google Maps Geocoding API).
-- Coordinates are computed and stored in the backend on card create/update;
-- the GPS verification endpoint (POST /api/cards/:id/verify-location) compares
-- the device location against these coordinates.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS latitude       DECIMAL(10,7);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS longitude      DECIMAL(10,7);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS geocoded_at    TIMESTAMPTZ;
-- geocode_status values: NULL (never attempted), 'ok', 'not_found', 'error', 'disabled'.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS geocode_status VARCHAR(20);

-- Geocode approval: after the backend geocodes an address, an admin visually
-- confirms the marker location on a map and approves it. Re-geocoding resets
-- approval to FALSE so the new location must be re-confirmed.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS geocode_approved     BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS geocode_approved_by  INTEGER     REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS geocode_approved_at  TIMESTAMPTZ;

-- Audit table — records collections that proceeded even though the collector's
-- GPS position was outside the configured radius from the card address.
CREATE TABLE IF NOT EXISTS location_overrides (
  id              SERIAL PRIMARY KEY,
  card_id         INTEGER NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  user_id         INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  distance_meters INTEGER,
  reason          TEXT,
  gps_lat         DECIMAL(10,7),
  gps_lng         DECIMAL(10,7),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_location_overrides_card_id ON location_overrides(card_id);
CREATE INDEX IF NOT EXISTS idx_location_overrides_user_id ON location_overrides(user_id);

-- ─────────────────────────────────────────
--  INSTALLATION TYPE  (סוג התקנה — חופשי)
--
--  Free-text label set on the card by the admin. An earlier iteration used
--  a lookup table (`installation_types` + `cards.installation_type_id`);
--  we dropped that and switched to a free-text column so the admin can
--  type any value without managing a list.
-- ─────────────────────────────────────────
ALTER TABLE cards DROP COLUMN IF EXISTS installation_type_id;
DROP TABLE IF EXISTS installation_types;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS installation_type VARCHAR(150);

-- ─────────────────────────────────────────
--  CITIES / DISTRICTS  (ערים ומחוזות)
--
--  Single-table mapping of city → district. The district column is free-text
--  (district list is derived from DISTINCT cities.district). Used to expand
--  district-based user assignments into the set of matching cities at query
--  time, and to surface cities that exist in cards but aren't in this table
--  (so an admin can assign them to a district).
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cities (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  district   VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cities_district ON cities(district);
