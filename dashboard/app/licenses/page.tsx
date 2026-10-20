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
  ConfirmDialog,
  useToast,
  api,
  buildQuery,
  formatDate,
  formatDateTime,
  cx,
  type LicenseRow,
  type LicenseListResponse,
  type Column,
} from "@/components/ui";
import {
  ExtendExpiryDialog,
  resolveLicenseKeyParam,
} from "@/components/licenses/ExtendExpiryDialog";
import { LicenseDetailDialog } from "@/components/licenses/LicenseDetailDialog";
import { GenerateStandaloneKeyDialog } from "@/components/licenses/GenerateStandaloneKeyDialog";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "expired", label: "Expired" },
] as const;

const PER_PAGE = 20;

interface RowAction {
  type: "view" | "extend" | "toggle" | "cancel";
  row: LicenseRow;
}

function LicensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filter, setFilter] = useState<string>(
    searchParams.get("filter") ?? "all",
  );
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [resp, setResp] = useState<LicenseListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailParam, setDetailParam] = useState<string | null>(null);
  const [detailHint, setDetailHint] = useState("");
  const [extendRow, setExtendRow] = useState<LicenseRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<RowAction | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

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
    router.replace(`/licenses${params.toString() ? `?${params}` : ""}`, {
      scroll: false,
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<LicenseListResponse>(
        `/api/admin/licenses${buildQuery({
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
      setError(err instanceof Error ? err.message : "Failed to load licenses.");
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

  const doToggle = async (row: LicenseRow) => {
    const action = row.status === "disabled" ? "enable" : "disable";
    try {
      await api(
        `/api/admin/licenses/${resolveLicenseKeyParam(row)}/${action}`,
        { method: "POST" },
      );
      toast(
        action === "disable" ? "License disabled." : "License enabled.",
        "success",
      );
      load();
    } catch (err) {
      // ConfirmDialog surfaces the error toast.
      throw err instanceof Error ? err : new Error(`Failed to ${action} license.`);
    }
  };

  const doCancel = async (row: LicenseRow) => {
    try {
      await api(`/api/admin/licenses/${resolveLicenseKeyParam(row)}/cancel`, {
        method: "POST",
      });
      toast("Pending key cancelled.", "success");
      load();
    } catch (err) {
      // ConfirmDialog surfaces the error toast.
      throw err instanceof Error ? err : new Error("Failed to cancel key.");
    }
  };

  const columns: Column<LicenseRow>[] = useMemo(
    () => [
      {
        key: "key",
        header: "Key",
        sortable: true,
        sortKey: "key_hint",
        render: (r) => (
          <span className="font-mono text-xs text-neutral-900">
            {r.key_hint}
          </span>
        ),
      },
      {
        key: "customer",
        header: "Customer",
        sortable: true,
        sortKey: "customer_name",
        render: (r) => (
          <span className="text-neutral-700">{r.customer_name || "—"}</span>
        ),
      },
      {
        key: "device",
        header: "Device",
        render: (r) =>
          r.device_db_id ? (
            <Link
              href={`/devices/${encodeURIComponent(r.device_db_id)}`}
              className="font-mono text-xs text-neutral-600 underline decoration-neutral-300 hover:text-neutral-900"
            >
              {r.device_id ?? r.device_db_id}
            </Link>
          ) : (
            <span className="font-mono text-xs text-neutral-400">
              {r.device_id ?? "—"}
            </span>
          ),
      },
      {
        key: "status",
        header: "Status",
        render: (r) => <Badge status={r.status} />,
      },
      {
        key: "expires",
        header: "Expires",
        sortable: true,
        sortKey: "expires_at",
        render: (r) => (
          <span className="whitespace-nowrap text-neutral-600">
            {r.expires_at ? formatDate(r.expires_at) : "Lifetime"}
          </span>
        ),
      },
      {
        key: "created",
        header: "Created",
        sortable: true,
        sortKey: "created_at",
        render: (r) => (
          <span
            className="whitespace-nowrap text-neutral-600"
            title={r.created_at ? formatDateTime(r.created_at) : undefined}
          >
            {r.created_at ? formatDate(r.created_at) : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        className: "text-right",
        render: (r) => (
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDetailParam(resolveLicenseKeyParam(r));
                setDetailHint(r.key_hint);
              }}
            >
              View
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setExtendRow(r)}
            >
              Extend
            </Button>
            <Button
              size="sm"
              variant={r.status === "disabled" ? "primary" : "danger"}
              onClick={() => setConfirmAction({ type: "toggle", row: r })}
            >
              {r.status === "disabled" ? "Enable" : "Disable"}
            </Button>
            {r.status === "pending" && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmAction({ type: "cancel", row: r })}
              >
                Cancel
              </Button>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const rows = resp?.data ?? [];
  const totalPages = resp?.total_pages ?? 0;
  const total = resp?.total ?? 0;

  const confirmConfig = confirmAction
    ? confirmAction.type === "cancel"
      ? {
          title: "Cancel this key?",
          confirmLabel: "Cancel key",
          description: (
            <>
              The pending key{" "}
              <span className="font-mono text-xs font-medium text-neutral-900">
                {confirmAction.row.key_hint}
              </span>{" "}
              will be permanently cancelled and can never be activated. This
              cannot be undone.
            </>
          ),
          onConfirm: () => doCancel(confirmAction.row),
        }
      : {
          title:
            confirmAction.row.status === "disabled"
              ? "Enable license?"
              : "Disable license?",
          confirmLabel:
            confirmAction.row.status === "disabled" ? "Enable" : "Disable",
          description: (
            <>
              {confirmAction.row.status === "disabled" ? (
                <>
                  Re-activate the key{" "}
                  <span className="font-mono text-xs font-medium text-neutral-900">
                    {confirmAction.row.key_hint}
                  </span>
                  .
                </>
              ) : (
                <>
                  The app using key{" "}
                  <span className="font-mono text-xs font-medium text-neutral-900">
                    {confirmAction.row.key_hint}
                  </span>{" "}
                  will stop working until the license is re-enabled.
                </>
              )}
            </>
          ),
          onConfirm: () => doToggle(confirmAction.row),
        }
    : null;

  return (
    <>
      <PageHeader
        title="License Keys"
        description="All generated license keys and their status."
        actions={
          <Button variant="primary" onClick={() => setGenerateOpen(true)}>
            Generate key
          </Button>
        }
      />

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status filter">
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
              id="license-search"
              placeholder="Search key or customer…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {!loading && !error && (
          <p className="mb-2 text-xs text-neutral-500">
            {total} {total === 1 ? "key" : "keys"}
            {debouncedQ && (
              <>
                {" "}matching <span className="font-medium">“{debouncedQ}”</span>
              </>
            )}
          </p>
        )}

        <Table<LicenseRow>
          columns={columns}
          rows={rows}
          rowKey={(r, i) => `${r.key_hint}-${i}`}
          sort={sort}
          order={order}
          onSort={handleSort}
          loading={loading}
          error={error}
          onRetry={load}
          emptyTitle="No license keys found"
          emptyDescription="No keys match the current search and filters. Generate a key from a device to get started."
        />

        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </Card>

      <LicenseDetailDialog
        open={detailParam !== null}
        onClose={() => setDetailParam(null)}
        licenseParam={detailParam}
        fallbackKeyHint={detailHint}
      />

      {extendRow && (
        <ExtendExpiryDialog
          open={extendRow !== null}
          onClose={() => setExtendRow(null)}
          keyHint={extendRow.key_hint}
          currentExpiresAt={extendRow.expires_at}
          licenseParam={resolveLicenseKeyParam(extendRow)}
          onSuccess={load}
        />
      )}

      <GenerateStandaloneKeyDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSuccess={load}
      />

      {confirmConfig && (
        <ConfirmDialog
          open={confirmAction !== null}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmConfig.onConfirm}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmLabel}
          variant={
            confirmAction?.type === "cancel" ||
            confirmAction?.row.status !== "disabled"
              ? "danger"
              : "primary"
          }
        />
      )}
    </>
  );
}

export default function LicensesPage() {
  return (
    <DashboardShell>
      <Suspense>
        <LicensesContent />
      </Suspense>
    </DashboardShell>
  );
}
