"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  Table,
  Badge,
  Button,
  Dialog,
  Input,
  Spinner,
  CopyButton,
  ConfirmDialog,
  useToast,
  api,
  formatDate,
  formatDateTime,
  timeAgo,
  type Device,
  type DeviceDetailResponse,
  type ActivityEvent,
  type Column,
} from "@/components/ui";
import { GenerateKeyDialog } from "@/components/devices/GenerateKeyDialog";
import {
  ExtendExpiryDialog,
  resolveLicenseKeyParam,
} from "@/components/licenses/ExtendExpiryDialog";

function eventLabel(e: ActivityEvent): string {
  return e.event_type ?? e.type ?? "—";
}

function eventTime(e: ActivityEvent): string {
  return e.created_at ?? e.at ?? "";
}

function DeviceDetailContent() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { toast } = useToast();

  const [device, setDevice] = useState<Device | null>(null);
  const [license, setLicense] = useState<DeviceDetailResponse["license"]>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revealed, setRevealed] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<null | "disable" | "enable">(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api<DeviceDetailResponse>(
        `/api/admin/devices/${encodeURIComponent(id)}`,
      );
      setDevice(r.device);
      setLicense(r.license);
      setEvents(r.events ?? []);
      setEditName(r.device.customer_name ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load device.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveLabel = async () => {
    if (!device || editPending) return;
    setEditPending(true);
    try {
      await api(`/api/admin/devices/${encodeURIComponent(device.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ customer_name: editName.trim() }),
      });
      toast("Customer label updated.", "success");
      setEditOpen(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update label.", "error");
    } finally {
      setEditPending(false);
    }
  };

  const toggleLicense = async () => {
    if (!license || !confirmToggle) return;
    const action = confirmToggle;
    try {
      await api(
        `/api/admin/licenses/${resolveLicenseKeyParam(license)}/${action}`,
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

  const eventColumns: Column<ActivityEvent>[] = [
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
      key: "outcome",
      header: "Outcome",
      render: (e) => <Badge status={e.outcome ?? "info"} />,
    },
    {
      key: "detail",
      header: "Detail",
      render: (e) => (
        <span className="text-neutral-600">{e.detail ?? e.message ?? "—"}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center py-20">
        <Spinner className="h-8 w-8 text-neutral-400" />
        <p className="mt-3 text-sm text-neutral-500">Loading device…</p>
      </div>
    );
  }

  if (error || !device) {
    return (
      <Card>
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-red-700">
            Failed to load device
          </p>
          <p className="mt-1 text-sm text-neutral-500">{error}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
            <Link href="/devices">
              <Button variant="ghost" size="sm">
                ← Back to devices
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  const infoRows: [string, string][] = [
    ["Customer", device.customer_name || "—"],
    ["Device ID", device.device_id],
    ["Manufacturer", device.manufacturer || "—"],
    ["Model", device.model || "—"],
    ["Android version", device.android_version || "—"],
    ["App version", device.app_version || "—"],
    ["Registered", formatDateTime(device.registered_at)],
    [
      "Last seen",
      device.last_seen_at
        ? `${formatDateTime(device.last_seen_at)} (${timeAgo(device.last_seen_at)})`
        : "Never",
    ],
  ];

  return (
    <>
      <PageHeader
        title={device.customer_name || "Device"}
        description={`Device detail · ${device.device_id}`}
        actions={
          <Link href="/devices">
            <Button variant="secondary" size="sm">
              ← All devices
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device info */}
        <Card
          title="Device info"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditName(device.customer_name ?? "");
                setEditOpen(true);
              }}
            >
              Edit label
            </Button>
          }
        >
          <dl className="divide-y divide-neutral-100">
            {infoRows.map(([k, v]) => (
              <div key={k} className="flex gap-4 py-2.5 text-sm">
                <dt className="w-36 shrink-0 text-neutral-500">{k}</dt>
                <dd
                  className={`text-neutral-900 ${
                    k === "Device ID" ? "break-all font-mono text-xs" : ""
                  }`}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* License */}
        <Card title="License">
          {license ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-neutral-900 px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                  License key
                </p>
                <p className="mt-1 break-all font-mono text-base text-white">
                  {revealed ? license.key : license.key_hint}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealed((r) => !r)}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
                  >
                    {revealed ? "Hide" : "Reveal"}
                  </button>
                  {revealed && (
                    <CopyButton text={license.key} label="Copy key" />
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Status</dt>
                  <dd className="mt-1">
                    <Badge status={license.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Expires
                  </dt>
                  <dd className="mt-1 text-neutral-900">
                    {license.expires_at
                      ? formatDate(license.expires_at)
                      : "Lifetime"}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExtendOpen(true)}
                >
                  Extend expiry
                </Button>
                {license.status === "disabled" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setConfirmToggle("enable")}
                  >
                    Enable license
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmToggle("disable")}
                  >
                    Disable license
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-neutral-900">
                No license key yet
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Generate a key to activate this device.
              </p>
              <div className="mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setKeyDialogOpen(true)}
                >
                  Generate key
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Activation history */}
      <div className="mt-6">
        <Card
          title="Activation history"
          description="Events recorded for this device."
        >
          <Table<ActivityEvent>
            columns={eventColumns}
            rows={events}
            rowKey={(e, i) => (e.id != null ? String(e.id) : `ev-${i}`)}
            emptyTitle="No events yet"
            emptyDescription="Activation attempts and license changes for this device will appear here."
          />
        </Card>
      </div>

      {/* Dialogs */}
      <GenerateKeyDialog
        open={keyDialogOpen}
        device={device}
        onClose={() => setKeyDialogOpen(false)}
        onSuccess={load}
      />

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit customer label"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={editPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={saveLabel}
              loading={editPending}
            >
              Save
            </Button>
          </>
        }
      >
        <Input
          id="edit-customer-name"
          label="Customer name"
          placeholder="e.g. Ahmed Tailors"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          disabled={editPending}
        />
      </Dialog>

      {license && (
        <ExtendExpiryDialog
          open={extendOpen}
          onClose={() => setExtendOpen(false)}
          keyHint={license.key_hint}
          currentExpiresAt={license.expires_at}
          licenseParam={resolveLicenseKeyParam(license)}
          onSuccess={load}
        />
      )}

      <ConfirmDialog
        open={confirmToggle !== null}
        onClose={() => setConfirmToggle(null)}
        onConfirm={toggleLicense}
        title={confirmToggle === "disable" ? "Disable license?" : "Enable license?"}
        confirmLabel={confirmToggle === "disable" ? "Disable" : "Enable"}
        variant={confirmToggle === "disable" ? "danger" : "primary"}
        description={
          confirmToggle === "disable" ? (
            <>
              The app on{" "}
              <span className="font-medium text-neutral-900">
                {device.device_id}
              </span>{" "}
              will stop working until the license is re-enabled. This can be
              undone at any time.
            </>
          ) : (
            <>
              Re-activate the license for{" "}
              <span className="font-medium text-neutral-900">
                {device.device_id}
              </span>
              .
            </>
          )
        }
      />
    </>
  );
}

export default function DeviceDetailPage() {
  return (
    <DashboardShell>
      <Suspense>
        <DeviceDetailContent />
      </Suspense>
    </DashboardShell>
  );
}
