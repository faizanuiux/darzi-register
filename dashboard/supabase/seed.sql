-- seed.sql — DEV-ONLY local development seed.
--
-- WARNING: this file is for LOCAL DEV / scratch databases ONLY.
-- Never run it against the production Supabase project, and never put real
-- customer data, real license keys, or real credentials in it.
-- The "keys" below are fake and follow the DRZ-XXXX-XXXX shape.

-- Requires the migrations in ./migrations/ to be applied first.

-- Fake licenses (backfill in 20261019_extend_licenses.sql fills key_hint/key_hash).
INSERT INTO licenses (key, customer_name, used, device_id, enabled, admin_note)
VALUES
  ('DRZ-AAAA-1111', 'Dev Tailor One', false, NULL, true, 'dev seed'),
  ('DRZ-BBBB-2222', 'Dev Tailor Two', true,  'dev-android-id-001', true, 'dev seed')
ON CONFLICT (key) DO NOTHING;

UPDATE licenses
SET
  key_hash = encode(digest(upper(key), 'sha256'), 'hex'),
  key_hint = 'DRZ-••••-' || right(key, 4)
WHERE key_hash IS NULL;

-- Fake device row matching the activated fake license above.
INSERT INTO devices (device_id, customer_name, manufacturer, model, android_version, app_version)
VALUES
  ('dev-android-id-001', 'Dev Tailor Two', 'DevBrand', 'DevModel X', '14', '1.0.3-dev')
ON CONFLICT (device_id) DO NOTHING;

-- A sample activation event (masked hint only — never plaintext keys here).
INSERT INTO activation_events (device_id, license_key_hint, event_type, outcome, actor_type, metadata)
VALUES
  ('dev-android-id-001', 'DRZ-••••-2222', 'activated', 'success', 'app',
   '{"seed": true}'::jsonb);
