"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  Table,
  Badge,
  Spinner,
  Button,
  api,
  formatDateTime,
  type Metrics,
  type ActivityEvent,
  type ActivityResponse,
  type Column,
} from "@/components/ui";

interface MetricCard {
  key: keyof Metrics;
  label: string;
  href: string;
  icon: string;
  accent: string;
}

const METRIC_CARDS: MetricCard[] = [
  { key: "total_devices", label: "Total devices", href: "/devices", icon: "▣", accent: "bg-neutral-900" },
  { key: "keys_generated", label: "Keys generated", href: "/licenses", icon: "⚿", accent: "bg-indigo-600" },
  { key: "active_licenses", label: "Active licenses", href: "/licenses?filter=active", icon: "✓", accent: "bg-emerald-600" },
  { key: "disabled_licenses", label: "Disabled licenses", href: "/licenses?filter=disabled", icon: "✕", accent: "bg-red-600" },
  { key: "expired_licenses", label: "Expired licenses", href: "/licenses?filter=expired", icon: "◷", accent: "bg-amber-600" },
  { key: "unused_keys", label: "Unused keys", href: "/licenses?filter=pending", icon: "○", accent: "bg-blue-600" },
  { key: "pending_devices", label: "Pending devices", href: "/devices?filter=pending", icon: "◔", accent: "bg-sky-600" },
  { key: "activations_last_7d", label: "Activations · last 7 days", href: "/activity", icon: "▲", accent: "bg-teal-600" },
];

function eventLabel(e: ActivityEvent): string {
  return e.event_type ?? e.type ?? "—";
}

function eventTime(e: ActivityEvent): string {
  return e.created_at ?? e.at ?? "";
}

function DashboardContent() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);

  const loadMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const m = await api<Metrics>("/api/admin/metrics");
      setMetrics(m);
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : "Failed to load metrics.");
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadActivity = async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const r = await api<ActivityResponse>("/api/admin/activity?per_page=10");
      setActivity(r.data ?? []);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "Failed to load activity.");
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    loadActivity();
  }, []);

  const activityColumns: Column<ActivityEvent>[] = [
    {
      key: "time",
      header: "Time",
      render: (e) => (
        <span className="whitespace-nowrap text-neutral-600">
          {formatDateTime(eventTime(e))}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (e) => (
        <span className="font-medium text-neutral-900">{eventLabel(e)}</span>
      ),
    },
    {
      key: "device",
      header: "Device",
      render: (e) => (
        <span className="font-mono text-xs text-neutral-600">
          {e.device_id ?? "—"}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (e) => (
        <span className="text-neutral-700">{e.customer_name ?? "—"}</span>
      ),
    },
    {
      key: "outcome",
      header: "Outcome",
      render: (e) => <Badge status={e.outcome ?? "info"} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of devices, license keys and recent activation activity."
      />

      {/* Metric cards */}
      {metricsLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex h-28 items-center justify-center rounded-xl border border-neutral-200 bg-white"
            >
              <Spinner className="h-5 w-5 text-neutral-300" />
            </div>
          ))}
        </div>
      ) : metricsError ? (
        <Card>
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-red-700">
              Failed to load metrics
            </p>
            <p className="mt-1 text-sm text-neutral-500">{metricsError}</p>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={loadMetrics}>
                Retry
              </Button>
            </div>
          </div>
        </Card>
      ) : metrics ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {METRIC_CARDS.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              className="group rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm text-white ${c.accent}`}
                  aria-hidden="true"
                >
                  {c.icon}
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold tabular-nums text-neutral-900">
                {metrics[c.key] ?? 0}
              </p>
              <p className="mt-1 text-sm text-neutral-500 group-hover:text-neutral-700">
                {c.label} →
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      {/* Recent activity */}
      <div className="mt-8">
        <Card
          title="Recent activity"
          description="Latest activation and license events."
          actions={
            <Link href="/activity">
              <Button variant="secondary" size="sm">
                View all →
              </Button>
            </Link>
          }
        >
          <Table<ActivityEvent>
            columns={activityColumns}
            rows={activity}
            rowKey={(e, i) => (e.id != null ? String(e.id) : `row-${i}`)}
            loading={activityLoading}
            error={activityError}
            onRetry={loadActivity}
            emptyTitle="No recent activity"
            emptyDescription="Activation and license events will appear here."
          />
        </Card>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <DashboardShell>
      <Suspense>
        <DashboardContent />
      </Suspense>
    </DashboardShell>
  );
}
