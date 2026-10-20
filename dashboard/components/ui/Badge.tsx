"use client";

import { cx } from "./cx";

const styles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/25",
  disabled: "bg-red-50 text-red-700 ring-red-600/25",
  expired: "bg-amber-50 text-amber-800 ring-amber-600/25",
  pending: "bg-blue-50 text-blue-700 ring-blue-600/25",
  "no-key": "bg-neutral-100 text-neutral-600 ring-neutral-500/25",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/25",
  failed: "bg-red-50 text-red-700 ring-red-600/25",
  failure: "bg-red-50 text-red-700 ring-red-600/25",
  error: "bg-red-50 text-red-700 ring-red-600/25",
  info: "bg-blue-50 text-blue-700 ring-blue-600/25",
};

const labels: Record<string, string> = {
  "no-key": "No key",
  success: "Success",
  failed: "Failed",
  failure: "Failed",
};

function labelFor(status: string): string {
  if (!status) return "—";
  return (
    labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)
  );
}

export function Badge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[status] ?? "bg-neutral-100 text-neutral-600 ring-neutral-500/25",
        className,
      )}
    >
      {label ?? labelFor(status)}
    </span>
  );
}
