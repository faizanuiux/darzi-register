"use client";

import { useState } from "react";
import {
  Dialog,
  Button,
  Input,
  CopyButton,
  useToast,
  api,
  type Device,
  type GenerateKeyResponse,
} from "../ui";

type ExpiryChoice = "30" | "90" | "180" | "365" | "custom" | "lifetime";

interface GenerateKeyDialogProps {
  open: boolean;
  onClose: () => void;
  device: Device;
  /** Called after the key is created so the parent can refresh its data. */
  onSuccess: () => void;
}

export function GenerateKeyDialog({
  open,
  onClose,
  device,
  onSuccess,
}: GenerateKeyDialogProps) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState(device.customer_name ?? "");
  const [choice, setChoice] = useState<ExpiryChoice>("365");
  const [customDate, setCustomDate] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GenerateKeyResponse | null>(null);

  const close = () => {
    if (pending) return;
    setResult(null);
    onClose();
  };

  const handleGenerate = async () => {
    if (pending) return;

    let expiry: Record<string, unknown>;
    if (choice === "lifetime") {
      expiry = { type: "lifetime" };
    } else if (choice === "custom") {
      if (!customDate) {
        toast("Pick an expiry date or choose another option.", "error");
        return;
      }
      expiry = { type: "custom", date: new Date(customDate).toISOString() };
    } else {
      expiry = { type: "days", days: Number(choice) };
    }

    setPending(true);
    try {
      const res = await api<GenerateKeyResponse>(
        `/api/admin/devices/${encodeURIComponent(device.id)}/generate-key`,
        {
          method: "POST",
          body: JSON.stringify({
            customer_name: customerName.trim() || undefined,
            expiry,
          }),
        },
      );
      setResult(res);
      onSuccess();
      toast("License key generated.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate key.", "error");
    } finally {
      setPending(false);
    }
  };

  const radioRow = (
    value: ExpiryChoice,
    label: string,
    hint?: string,
  ) => (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
        choice === value
          ? "border-neutral-900 bg-neutral-50"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <input
        type="radio"
        name="expiry"
        value={value}
        checked={choice === value}
        onChange={() => setChoice(value)}
        className="accent-neutral-900"
      />
      <span className="text-sm font-medium text-neutral-900">{label}</span>
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );

  return (
    <Dialog
      open={open}
      onClose={close}
      title={result ? "Key generated" : "Generate license key"}
      description={
        result
          ? "Share this key with the customer now — it won't be shown again."
          : undefined
      }
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleGenerate} loading={pending}>
              Generate key
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠ This is the only time the full key is displayed. Copy it now
            and share it with the customer before closing this dialog.
          </div>
          <div className="rounded-lg bg-neutral-900 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              License key
            </p>
            <p className="mt-1 break-all font-mono text-lg text-white">
              {result.key}
            </p>
          </div>
          <CopyButton text={result.key} label="Copy key" size="md" />
          {result.expires_at && (
            <p className="text-sm text-neutral-500">
              Expires:{" "}
              {new Date(result.expires_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-neutral-50 px-4 py-3 text-sm">
            <p className="font-medium text-neutral-900">Device</p>
            <p className="mt-0.5 font-mono text-xs text-neutral-600">
              {device.device_id}
            </p>
            {device.manufacturer || device.model ? (
              <p className="text-xs text-neutral-500">
                {[device.manufacturer, device.model].filter(Boolean).join(" ")}
              </p>
            ) : null}
          </div>

          <Input
            id="gk-customer"
            label="Customer name (optional)"
            placeholder="e.g. Ahmed Tailors"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={pending}
          />

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">Expiry</p>
            <div className="grid grid-cols-2 gap-2">
              {radioRow("30", "30 days")}
              {radioRow("90", "90 days")}
              {radioRow("180", "180 days")}
              {radioRow("365", "1 year", "default")}
              {radioRow("custom", "Custom date")}
              {radioRow("lifetime", "Lifetime", "never expires")}
            </div>
            {choice === "custom" && (
              <div className="mt-2">
                <Input
                  id="gk-custom-date"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  disabled={pending}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
