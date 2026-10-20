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
