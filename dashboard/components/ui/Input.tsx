"use client";

import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
}

export function Input({ label, error, className, id, ...rest }: InputProps) {
  return (
    <div className={cx("w-full", className)}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-neutral-700"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        {...rest}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
