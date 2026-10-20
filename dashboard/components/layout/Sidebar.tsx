"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "../ui/cx";
import { api } from "../ui/api";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/devices", label: "Devices & Customers", icon: "▣" },
  { href: "/licenses", label: "License Keys", icon: "⚿" },
  { href: "/activity", label: "Activation Activity", icon: "◔" },
  { href: "/settings", label: "Profile & Settings", icon: "⚙" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      // Proceed to login even if the API call fails — the session cookie
      // refresh flow will bounce unauthenticated users anyway.
    } finally {
      router.push("/login");
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-neutral-900/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-200 bg-white transition-all duration-200",
          "transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-20",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-neutral-100 px-4">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            onClick={onCloseMobile}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-base text-white">
              ✂
            </span>
            {!collapsed && (
              <span className="truncate text-sm font-semibold text-neutral-900">
                Darzi Register
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                title={collapsed ? item.label : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  collapsed && "lg:justify-center lg:px-0",
                )}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {collapsed && (
                  <span className="sr-only lg:hidden">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="space-y-1 border-t border-neutral-100 px-3 py-3">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            title={collapsed ? "Logout" : undefined}
            className={cx(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition",
              "hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {loggingOut ? "…" : "⏻"}
            </span>
            {!collapsed && <span>{loggingOut ? "Signing out…" : "Logout"}</span>}
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden w-full items-center justify-center rounded-lg px-3 py-2 text-xs text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 lg:flex"
          >
            {collapsed ? "→" : "← Collapse"}
          </button>
        </div>
      </aside>
    </>
  );
}
