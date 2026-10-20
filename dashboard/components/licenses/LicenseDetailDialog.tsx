"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  Badge,
  Spinner,
  CopyButton,
  useToast,
  api,
  formatDateTime,
  type LicenseDetail,
} from "../ui";

interface LicenseDetailDialogProps {
  open: boolean;
  onClose: () => void;
  /** URL-encoded key used to fetch the detail (full key or key_hint). */
  licenseParam: string | null;
  fallbackKeyHint: string;
}

export function LicenseDetailDialog({
  open,
  onClose,
  licenseParam,
  fallbackKeyHint,
}: LicenseDetailDialogProps) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<LicenseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!open || !licenseParam) return;
    setDetail(null);
    setError(null);
    setRevealed(false);
    setLoading(true);
    api<{ license: LicenseDetail }>(`/api/admin/licenses/${licenseParam}`)
      .then((res) => setDetail(res.license))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load license."),
      )
      .finally(() => setLoading(false));
  }, [open, licenseParam]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="License details"
      footer={null}
    >
      {loading ? (
        <div className="flex flex-col items-center py-8">
          <Spinner className="h-6 w-6 text-neutral-400" />
          <p className="mt-2 text-sm text-neutral-500">Loading…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : detail ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-neutral-900 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              License key
            </p>
            <p className="mt-1 break-all font-mono text-base text-white">
              {revealed ? detail.key : detail.key_hint}
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
                <CopyButton text={detail.key} label="Copy key" />
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-neutral-500">Status</dt>
              <dd className="mt-1">
                <Badge status={detail.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500">Expires</dt>
              <dd className="mt-1 text-neutral-900">
                {detail.expires_at
                  ? formatDateTime(detail.expires_at)
                  : "Lifetime"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500">Customer</dt>
              <dd className="mt-1 text-neutral-900">
                {detail.customer_name || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500">Device</dt>
              <dd className="mt-1 break-all font-mono text-xs text-neutral-900">
                {detail.device_id || "—"}
              </dd>
            </div>
            {detail.created_at && (
              <div>
                <dt className="text-xs font-medium text-neutral-500">
                  Created
                </dt>
                <dd className="mt-1 text-neutral-900">
                  {formatDateTime(detail.created_at)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">{fallbackKeyHint}</p>
      )}
    </Dialog>
  );
}
