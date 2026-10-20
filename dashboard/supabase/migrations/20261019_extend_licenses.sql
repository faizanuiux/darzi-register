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
