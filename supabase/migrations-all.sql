-- =============================================================
-- FILE: 20261019_devices.sql
-- =============================================================
-- Migration: 20261019_devices.sql
-- Creates the `devices` table: known app installations that the dashboard can
-- list, inspect, and correlate with license rows.
--
-- DELIBERATE NON-FK: there is intentionally NO foreign key from
-- `licenses.device_id` to `devices.device_id`. The live mobile app activates
-- by PATCHing `device_id` onto a license row directly with the anon key,
-- without any device row existing first; a FK would break that old flow.
-- Correlation between the two tables is done by the service layer on
-- `device_id` equality, not by constraints.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

-- gen_random_uuid() comes from pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       TEXT UNIQUE NOT NULL,  -- e.g. Android Settings.Secure ANDROID_ID
  customer_name   TEXT,
  manufacturer    TEXT,
  model           TEXT,
  android_version TEXT,
  app_version     TEXT,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_registered_at_idx
  ON devices (registered_at DESC);

-- =============================================================
-- FILE: 20261019_events_audit.sql
-- =============================================================
-- Migration: 20261019_events_audit.sql
-- Creates `activation_events` (append-only log of license/device events) and
-- `admin_audit_logs` (append-only log of admin actions taken from the
-- dashboard). Both are write-mostly, read-by-dashboard tables.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

-- gen_random_uuid() comes from pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS activation_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        TEXT,
  -- MASKED key hint only (e.g. 'DRZ-••••-EFGH'). NEVER store a plaintext
  -- license key in this column; plaintext keys live ONLY in `licenses.key`.
  license_key_hint TEXT,
  event_type       TEXT NOT NULL,  -- e.g. 'activation_attempt', 'activated', 'validation', 'disabled', 'expired'
  outcome          TEXT NOT NULL,  -- e.g. 'success', 'failed', 'blocked'
  metadata         JSONB NOT NULL DEFAULT '{}',
  actor_type       TEXT NOT NULL DEFAULT 'system',  -- 'system' | 'app' | 'admin'
  actor_id         UUID,  -- auth.users id when actor_type = 'admin'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN activation_events.license_key_hint IS
  'Masked key hint only (e.g. DRZ-••••-EFGH). NEVER store a plaintext license key in this table.';

CREATE INDEX IF NOT EXISTS activation_events_created_at_idx
  ON activation_events (created_at DESC);
CREATE INDEX IF NOT EXISTS activation_events_device_id_idx
  ON activation_events (device_id);
CREATE INDEX IF NOT EXISTS activation_events_event_type_idx
  ON activation_events (event_type);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL,  -- auth.users id of the admin who acted
  action      TEXT NOT NULL,  -- e.g. 'license.issue', 'license.disable', 'license.enable', 'settings.update'
  target_type TEXT,           -- e.g. 'license', 'device', 'setting'
  target_id   TEXT,           -- primary key / natural id of the target (never a plaintext license key)
  details     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
  ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_id_idx
  ON admin_audit_logs (admin_id);

-- =============================================================
-- FILE: 20261019_extend_licenses.sql
-- =============================================================
-- Migration: 20261019_extend_licenses.sql
-- Extends the existing `licenses` table for the Darzi Register admin dashboard.
--
-- HARD RULE (do not violate): the live mobile app reads/writes this table
-- DIRECTLY with the anon key (GET row by key; PATCH used/device_id/activated_at
-- on activation). The existing columns `key`, `customer_name`, `used`,
-- `device_id`, `created_at`, `activated_at` and their types/semantics are
-- NEVER renamed, dropped, or altered here.
--
-- Idempotency: every statement below is safe to re-run (IF NOT EXISTS /
-- IF NOT EXISTS-style guards, and a backfill guarded by `key_hash IS NULL`).
-- No new NOT NULL column without a DEFAULT, so existing mobile INSERTs and
-- PATCHes keep working unchanged.

-- Needed for digest() (SHA-256) used in the backfill below.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Expiry
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2) Revocation / enable-disable
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
-- auth.users id of the admin who disabled the key (nullable; no FK so that
-- deleting an auth user never blocks or cascades into license rows).
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS disabled_by UUID;

-- 3) Provenance / admin metadata
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS issued_by UUID;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS admin_note TEXT;
-- Last time the key was checked by a validation endpoint / the app.
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

-- 4) Masked key material for dashboard display.
-- The plaintext key continues to live ONLY in `licenses.key`.
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS key_hint TEXT;  -- e.g. 'DRZ-••••-EFGH'
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS key_hash TEXT;  -- SHA-256 hex of uppercased key

-- 5) Backfill masked material for rows that predate these columns.
-- Reruns only touch rows that still lack a key_hash.
UPDATE licenses
SET
  key_hash = encode(digest(upper(key), 'sha256'), 'hex'),
  key_hint = 'DRZ-••••-' || right(key, 4)
WHERE key_hash IS NULL;

-- 6) Indexes
-- One current license per device. PARTIAL index: NULL device_ids (keys not
-- yet activated) are exempt, so key creation is never blocked.
-- NOTE for mobile compat: an activation PATCH that reuses a device_id already
-- held by another key will now fail with a unique-violation (23505). The
-- dashboard/API layer must move/clear the device_id (or disable the old key)
-- before issuing a replacement key to the same device.
CREATE UNIQUE INDEX IF NOT EXISTS licenses_device_id_unique
  ON licenses (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS licenses_expires_at_idx ON licenses (expires_at);
CREATE INDEX IF NOT EXISTS licenses_enabled_idx ON licenses (enabled);

-- =============================================================
-- FILE: 20261019_settings.sql
-- =============================================================
-- Migration: 20261019_settings.sql
-- Creates `app_settings`: a small key/value store for dashboard-configurable
-- app behaviour (e.g. how long newly issued licenses last).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING,
-- so re-runs never overwrite values an admin may have changed.

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID  -- auth.users id of the admin who last changed it
);

INSERT INTO app_settings (key, value) VALUES
  ('default_license_days', '365'),          -- validity period for newly issued keys
  ('business_name',        'Darzi Register'),
  ('owner_name',           'Faizan'),
  ('timezone',             'Asia/Karachi')
ON CONFLICT (key) DO NOTHING;

-- =============================================================
-- FILE: 20261019_rls.sql
-- =============================================================
-- Migration: 20261019_rls.sql
-- RLS posture for the new dashboard tables.
--
-- All new tables (devices, activation_events, admin_audit_logs, app_settings)
-- get ROW LEVEL SECURITY enabled with NO permissive policies for anyone.
-- Effect: deny-by-default for EVERY role, including anon and authenticated.
--
-- This is intentional. The dashboard server talks to Supabase EXCLUSIVELY
-- with the service-role key, which bypasses RLS entirely, so all dashboard
-- reads/writes keep working while the public PostgREST surface stays closed.
-- Adding no policies at all (rather than restrictive policies) makes the
-- deny-by-default posture explicit and impossible to weaken by accident
-- through a forgotten permissive policy.
--
-- The EXISTING `licenses` table is deliberately NOT touched here. Its current
-- permissive anon read/insert/update policies are what the live mobile app
-- depends on (GET row by key, then PATCH used/device_id/activated_at with the
-- anon key). Changing them now would break every installed app, so they are
-- intentionally retained for mobile backward compatibility.
--
-- Future tightening path (do this ONLY in this order):
--   1. Route all mobile license traffic through the dashboard's /api/* routes
--      (which use the service-role key).
--   2. Ship an app update whose activation/validation code calls those routes
--      instead of hitting Supabase directly.
--   3. Wait until old-flow direct activations have drained (check
--      activation_events for stale direct writes / app versions).
--   4. Only then: drop the anon policies on `licenses` and restrict the
--      table to service-role-only access.

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

