"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  Table,
  Badge,
  Button,
  Input,
  Select,
  Pagination,
  api,
  buildQuery,
  formatDateTime,
  type ActivityEvent,
  type ActivityResponse,
  type Column,
} from "@/components/ui";

const PER_PAGE = 25;

function eventLabel(e: ActivityEvent): string {
  return e.event_type ?? e.type ?? "—";
}

function eventTime(e: ActivityEvent): string {
  return e.created_at ?? e.at ?? "";
}

function ActivityContent() {
  const [eventType, setEventType] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [debouncedDevice, setDebouncedDevice] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [resp, setResp] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedDevice(deviceSearch);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [deviceSearch]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<ActivityResponse>(
        `/api/admin/activity${buildQuery({
          event_type: eventType || undefined,
          outcome: outcome === "all" ? undefined : outcome,
          device_id: debouncedDevice || undefined,
          date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
          date_to: dateTo
            ? new Date(`${dateTo}T23:59:59.999`).toISOString()
            : undefined,
          page,
          per_page: PER_PAGE,
        })}`,
      );
      setResp(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, outcome, debouncedDevice, dateFrom, dateTo, page]);

  const resetFilters = () => {
    setEventType("");
    setOutcome("all");
    setDeviceSearch("");
    setDebouncedDevice("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const columns: Column<ActivityEvent>[] = [
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
    {
      key: "detail",
      header: "Detail",
      render: (e) => (
        <span className="max-w-md truncate text-neutral-600" title={e.detail ?? e.message ?? undefined}>
          {e.detail ?? e.message ?? "—"}
        </span>
      ),
    },
  ];

  const rows = resp?.data ?? [];
  const totalPages = resp?.total_pages ?? 0;
  const total = resp?.total ?? 0;
  const hasFilters =
    eventType !== "" ||
    outcome !== "all" ||
    deviceSearch !== "" ||
    dateFrom !== "" ||
    dateTo !== "";

  return (
    <>
      <PageHeader
        title="Activation Activity"
        description="Audit log of activation attempts and license events."
      />

      <Card>
        {/* Filters */}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Input
            id="act-event-type"
            label="Event type"
            placeholder="e.g. activation"
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
          />
          <Select
            id="act-outcome"
            label="Outcome"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All outcomes" },
              { value: "success", label: "Success" },
              { value: "failure", label: "Failure" },
            ]}
          />
          <Input
            id="act-device"
            label="Device search"
            placeholder="Device ID…"
            value={deviceSearch}
            onChange={(e) => setDeviceSearch(e.target.value)}
          />
          <Input
            id="act-from"
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            id="act-to"
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              disabled={!hasFilters}
            >
              Clear filters
            </Button>
          </div>
        </div>

        {!loading && !error && (
          <p className="mb-2 text-xs text-neutral-500">
            {total} {total === 1 ? "event" : "events"}
          </p>
        )}

        <Table<ActivityEvent>
          columns={columns}
          rows={rows}
          rowKey={(e, i) => (e.id != null ? String(e.id) : `act-${i}`)}
          loading={loading}
          error={error}
          onRetry={load}
          emptyTitle="No events found"
          emptyDescription="No activity matches the current filters."
          emptyAction={
            hasFilters ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />

        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </Card>
    </>
  );
}

export default function ActivityPage() {
  return (
    <DashboardShell>
      <Suspense>
        <ActivityContent />
      </Suspense>
    </DashboardShell>
  );
}
