"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { Spinner } from "./Spinner";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  sortKey?: string;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  sort?: string;
  order?: "asc" | "desc";
  onSort?: (key: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

function SortArrow({ active, order }: { active: boolean; order?: string }) {
  if (!active) return <span className="text-neutral-300">↕</span>;
  return <span>{order === "asc" ? "↑" : "↓"}</span>;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  sort,
  order,
  onSort,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "No results",
  emptyDescription = "Nothing matches the current filters.",
  emptyAction,
}: TableProps<T>) {
  const span = columns.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            {columns.map((col) => {
              const active = col.sortable && sort === (col.sortKey ?? col.key);
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={cx(
                    "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500",
                    col.sortable && "select-none",
                    col.className,
                  )}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.sortKey ?? col.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-neutral-800"
                    >
                      {col.header}
                      <SortArrow active={!!active} order={order} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {loading ? (
            <tr>
              <td colSpan={span} className="px-3 py-12 text-center">
                <Spinner className="mx-auto h-6 w-6 text-neutral-400" />
                <p className="mt-2 text-sm text-neutral-500">Loading…</p>
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={span} className="px-3 py-12 text-center">
                <p className="text-sm font-medium text-red-700">
                  Failed to load
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
                  {error}
                </p>
                {onRetry && (
                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onRetry}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={span} className="px-3 py-4">
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  action={emptyAction}
                />
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                className="transition-colors hover:bg-neutral-50"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cx("px-3 py-3 align-middle", col.className)}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
