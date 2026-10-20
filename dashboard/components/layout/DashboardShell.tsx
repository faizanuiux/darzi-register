"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ToastProvider } from "../ui/Toast";
import { cx } from "../ui/cx";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div
          className={cx(
            "transition-all duration-200",
            collapsed ? "lg:pl-20" : "lg:pl-64",
          )}
        >
          {/* Mobile top bar */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100"
            >
              ☰
            </button>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-xs text-white">
                ✂
              </span>
              Darzi Register
            </span>
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
