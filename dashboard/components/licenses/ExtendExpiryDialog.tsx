"use client";

import { useState } from "react";
import { Dialog, Button, Input, useToast, api } from "../ui";

interface ExtendExpiryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Key hint shown in the dialog (the full key is resolved inside if needed). */
  keyHint: string;
  currentExpiresAt: string | null;
  onSuccess: () => void;
}

/**
 * NOTE: the [key] path segment uses the full license key when the caller has
 * it (device detail page), otherwise the key_hint from the list row. The API
 * is assumed to resolve either to the license record.
 */
export function resolveLicenseKeyParam(license: {
  key?: string;
  key_hint: string;
}): string {
  return encodeURIComponent(license.key ?? license.key_hint);
}

export function ExtendExpiryDialog({
  open,
  onClose,
  keyHint,
  currentExpiresAt,
  onSuccess,
  licenseParam,
}: ExtendExpiryDialogProps & { licenseParam: string }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"days" | "date" | "lifetime">("days");
  const [days, setDays] = useState("90");
  const [date, setDate] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (pending) return;

    let expires_at: string | null;
    if (mode === "lifetime") {
      expires_at = null;
    } else if (mode === "date") {
      if (!date) {
        toast("Pick a date or choose another option.", "error");
        return;
      }
      expires_at = new Date(date).toISOString();
    } else {
      const n = Number(days);
      if (!Number.isFinite(n) || n <= 0) {
        toast("Enter a valid number of days.", "error");
        return;
      }
      expires_at = new Date(Date.now() + n * 86_400_000).toISOString();
    }

    setPending(true);
    try {
      await api(`/api/admin/licenses/${licenseParam}/expiry`, {
        method: "PATCH",
        body: JSON.stringify({ expires_at }),
      });
      toast("Expiry updated.", "success");
      onSuccess();
      onClose();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to update expiry.",
        "error",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Extend license expiry"
      description={`Key ${keyHint}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={pending}>
            Save expiry
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {currentExpiresAt && (
          <p className="text-sm text-neutral-500">
            Currently expires:{" "}
            {new Date(currentExpiresAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        )}

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 hover:border-neutral-300">
            <input
              type="radio"
              name="extend-mode"
              checked={mode === "days"}
              onChange={() => setMode("days")}
              className="accent-neutral-900"
            />
            <span className="text-sm font-medium text-neutral-900">
              Extend by days
            </span>
          </label>
          {mode === "days" && (
            <Input
              id="extend-days"
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              disabled={pending}
              placeholder="90"
            />
          )}

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 hover:border-neutral-300">
            <input
              type="radio"
              name="extend-mode"
              checked={mode === "date"}
              onChange={() => setMode("date")}
              className="accent-neutral-900"
            />
            <span className="text-sm font-medium text-neutral-900">
              Set exact date
            </span>
          </label>
          {mode === "date" && (
            <Input
              id="extend-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={pending}
            />
          )}

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 hover:border-neutral-300">
            <input
              type="radio"
              name="extend-mode"
              checked={mode === "lifetime"}
              onChange={() => setMode("lifetime")}
              className="accent-neutral-900"
            />
            <span className="text-sm font-medium text-neutral-900">
              Lifetime
            </span>
            <span className="text-xs text-neutral-500">never expires</span>
          </label>
        </div>
      </div>
    </Dialog>
  );
}
