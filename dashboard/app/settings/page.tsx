"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  Button,
  Input,
  Spinner,
  Badge,
  useToast,
  api,
  type AppSettings,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

interface HealthState {
  ok: boolean;
  checkedAt: Date;
  note?: string;
}

function HealthCard() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [checking, setChecking] = useState(true);

  const check = async () => {
    setChecking(true);
    try {
      const started = Date.now();
      const res = await fetch("/api/health", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      const ok = res.ok && body?.ok === true;
      setHealth({
        ok,
        checkedAt: new Date(),
        note: ok
          ? `Responded in ${Date.now() - started} ms`
          : `HTTP ${res.status}`,
      });
    } catch (err) {
      setHealth({
        ok: false,
        checkedAt: new Date(),
        note: err instanceof Error ? err.message : "Unreachable",
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <Card
      title="Database health"
      description="Live status from the health endpoint — never simulated."
      actions={
        <Button variant="secondary" size="sm" onClick={check} disabled={checking}>
          {checking ? "Checking…" : "Re-check"}
        </Button>
      }
    >
      {checking && !health ? (
        <div className="flex items-center gap-3 py-4">
          <Spinner className="h-5 w-5 text-neutral-400" />
          <span className="text-sm text-neutral-500">Checking…</span>
        </div>
      ) : health ? (
        <div className="flex flex-wrap items-center gap-3 py-2">
          {health.ok ? (
            <Badge status="success" label="Connected" className="!px-3 !py-1 !text-sm" />
          ) : (
            <Badge status="failure" label="Disconnected" className="!px-3 !py-1 !text-sm" />
          )}
          <span className="text-sm text-neutral-500">
            {health.note} · checked {health.checkedAt.toLocaleTimeString()}
          </span>
        </div>
      ) : null}
    </Card>
  );
}

function SettingsContent() {
  const { toast } = useToast();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [defaultDays, setDefaultDays] = useState("365");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwPending, setPwPending] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await api<AppSettings>("/api/admin/settings");
      setSettings(s);
      setBusinessName(s.business_name ?? "");
      setOwnerName(s.owner_name ?? "");
      setDefaultDays(String(s.default_license_days ?? 365));
      setTimezone(s.timezone ?? "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSettings = async () => {
    if (saving) return;
    const days = Number(defaultDays);
    if (!Number.isFinite(days) || days <= 0) {
      toast("Default license days must be a positive number.", "error");
      return;
    }
    setSaving(true);
    try {
      const updated = await api<AppSettings>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          business_name: businessName.trim(),
          owner_name: ownerName.trim(),
          default_license_days: days,
          timezone: timezone.trim(),
        }),
      });
      setSettings(updated);
      toast("Settings saved.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (pwPending) return;
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Passwords do not match.", "error");
      return;
    }
    setPwPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw new Error(error.message);
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to change password.", "error");
    } finally {
      setPwPending(false);
    }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue to login regardless.
    } finally {
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center py-20">
        <Spinner className="h-8 w-8 text-neutral-400" />
        <p className="mt-3 text-sm text-neutral-500">Loading settings…</p>
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <Card>
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-red-700">
            Failed to load settings
          </p>
          <p className="mt-1 text-sm text-neutral-500">{loadError}</p>
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Profile & Settings"
        description="Business profile, dashboard settings and your admin account."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Business info (from settings API) */}
          <Card title="Business profile">
            <dl className="divide-y divide-neutral-100 text-sm">
              {(
                [
                  ["Business name", settings.business_name || "—"],
                  ["Owner", settings.owner_name || "—"],
                  ["Timezone", settings.timezone || "—"],
                  [
                    "Default license length",
                    `${settings.default_license_days} days`,
                  ],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex gap-4 py-2.5">
                  <dt className="w-44 shrink-0 text-neutral-500">{k}</dt>
                  <dd className="text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <HealthCard />
        </div>

        <div className="space-y-6">
          {/* Settings form */}
          <Card
            title="Settings"
            description="Used as defaults across the dashboard and key generation."
            actions={
              <Button variant="primary" size="sm" onClick={saveSettings} loading={saving}>
                Save settings
              </Button>
            }
          >
            <div className="space-y-3">
              <Input
                id="set-business"
                label="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                disabled={saving}
              />
              <Input
                id="set-owner"
                label="Owner name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={saving}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="set-days"
                  label="Default license days"
                  type="number"
                  min={1}
                  value={defaultDays}
                  onChange={(e) => setDefaultDays(e.target.value)}
                  disabled={saving}
                />
                <Input
                  id="set-timezone"
                  label="Timezone"
                  placeholder="e.g. Asia/Karachi"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </Card>

          {/* Change password */}
          <Card
            title="Change password"
            description="Updates your own admin account password."
            actions={
              <Button
                variant="primary"
                size="sm"
                onClick={changePassword}
                loading={pwPending}
              >
                Change password
              </Button>
            }
          >
            <div className="space-y-3">
              <Input
                id="pw-new"
                label="New password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={pwPending}
              />
              <Input
                id="pw-confirm"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={pwPending}
              />
            </div>
          </Card>

          {/* Session */}
          <Card title="Session">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-neutral-500">
                Sign out of the admin dashboard on this device.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={logout}
                loading={loggingOut}
              >
                Logout
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <DashboardShell>
      <Suspense>
        <SettingsContent />
      </Suspense>
    </DashboardShell>
  );
}
