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
