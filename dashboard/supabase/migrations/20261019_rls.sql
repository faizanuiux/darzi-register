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
