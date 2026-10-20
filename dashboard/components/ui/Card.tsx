"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: CardProps) {
  return (
    <section
      className={cx(
        "rounded-xl border border-neutral-200 bg-white shadow-sm",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-neutral-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-neutral-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
