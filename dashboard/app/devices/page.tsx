"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  Table,
  Badge,
  Button,
  Input,
  Pagination,
  api,
  buildQuery,
  formatDateTime,
  timeAgo,
  cx,
  type Device,
  type DeviceListResponse,
  type Column,
} from "@/components/ui";
import { GenerateKeyDialog } from "@/components/devices/GenerateKeyDialog";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "no-key", label: "No key" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
] as const;

const PER_PAGE = 20;

function deviceStatus(d: Device): string {
  return d.license ? d.license.status : "no-key";
}

function DevicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filter, setFilter] = useState<string>(
    searchParams.get("filter") ?? "all",
  );
  const [sort, setSort] = useState("registered_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [resp, setResp] = useState<DeviceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [keyDialogDevice, setKeyDialogDevice] = useState<Device | null>(null);

  // Debounce the search input.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const setFilterAndUrl = (f: string) => {
    setFilter(f);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (f === "all") params.delete("filter");
    else params.set("filter", f);
    router.replace(`/devices${params.toString() ? `?${params}` : ""}`, {
      scroll: false,
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<DeviceListResponse>(
        `/api/admin/devices${buildQuery({
          q: debouncedQ || undefined,
          filter: filter === "all" ? undefined : filter,
          sort,
          order,
          page,
          per_page: PER_PAGE,
        })}`,
      );
      setResp(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filter, sort, order, page]);

  const handleSort = (key: string) => {
    if (sort === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder("desc");
    }
    setPage(1);
  };

  const columns: Column<Device>[] = useMemo(
    () => [
      {
        key: "customer",
        header: "Customer",
        sortable: true,
        sortKey: "customer_name",
        render: (d) => (
          <div>
            <p className="font-medium text-neutral-900">
              {d.customer_name || <span className="text-neutral-400">Unnamed</span>}
            </p>
            <p className="font-mono text-xs text-neutral-500">{d.device_id}</p>
          </div>
        ),
      },
      {
        key: "device",
        header: "Device",
        render: (d) => (
          <span className="text-neutral-700">
            {[d.manufacturer, d.model].filter(Boolean).join(" ") || "—"}
          </span>
        ),
      },
      {
        key: "app",
        header: "App",
        sortable: true,
        sortKey: "app_version",
        render: (d) => (
          <span className="text-neutral-700">{d.app_version || "—"}</span>
        ),
      },
      {
        key: "registered",
        header: "Registered",
        sortable: true,
        sortKey: "registered_at",
        render: (d) => (
          <span
            className="whitespace-nowrap text-neutral-600"
            title={formatDateTime(d.registered_at)}
          >
            {timeAgo(d.registered_at)}
          </span>
        ),
      },
      {
        key: "last_seen",
        header: "Last seen",
        sortable: true,
        sortKey: "last_seen_at",
        render: (d) => (
          <span
            className="whitespace-nowrap text-neutral-600"
            title={formatDateTime(d.last_seen_at)}
          >
            {d.last_seen_at ? timeAgo(d.last_seen_at) : "Never"}
          </span>
        ),
      },
      {
        key: "status",
        header: "License",
        render: (d) => <Badge status={deviceStatus(d)} />,
      },
      {
        key: "actions",
        header: "Actions",
        className: "text-right",
        render: (d) => (
          <div className="flex justify-end gap-2">
            {!d.license && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setKeyDialogDevice(d)}
              >
                Generate key
              </Button>
            )}
            <Link href={`/devices/${encodeURIComponent(d.id)}`}>
              <Button size="sm" variant="secondary">
                View
              </Button>
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  const rows = resp?.data ?? [];
  const totalPages = resp?.total_pages ?? 0;
  const total = resp?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Devices & Customers"
        description="Registered app installs and their license status."
      />

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="License filter">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilterAndUrl(f.value)}
                className={cx(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  filter === f.value
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-72">
            <Input
              id="device-search"
              placeholder="Search customer or device ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {!loading && !error && (
          <p className="mb-2 text-xs text-neutral-500">
            {total} {total === 1 ? "device" : "devices"}
            {debouncedQ && (
              <>
                {" "}matching <span className="font-medium">“{debouncedQ}”</span>
              </>
            )}
          </p>
        )}

        <Table<Device>
          columns={columns}
          rows={rows}
          rowKey={(d) => d.id}
          sort={sort}
          order={order}
          onSort={handleSort}
          loading={loading}
          error={error}
          onRetry={load}
          emptyTitle="No devices found"
          emptyDescription="No devices match the current search and filters."
        />

        <div className="mt-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
          />
        </div>
      </Card>

      {keyDialogDevice && (
        <GenerateKeyDialog
          open={!!keyDialogDevice}
          device={keyDialogDevice}
          onClose={() => setKeyDialogDevice(null)}
          onSuccess={load}
        />
      )}
    </>
  );
}

export default function DevicesPage() {
  return (
    <DashboardShell>
      <Suspense>
        <DevicesContent />
      </Suspense>
    </DashboardShell>
  );
}
