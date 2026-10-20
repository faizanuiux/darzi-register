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
