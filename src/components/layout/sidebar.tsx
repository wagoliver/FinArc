"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { signOut } from "next-auth/react";
import { useSidebar } from "./sidebar-context";

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-700 bg-[#1E293B] transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-16 items-center gap-3", collapsed ? "justify-center px-2" : "px-6")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
          <span className="text-base font-bold text-white">F</span>
        </div>
        {!collapsed && (
          <div>
            <span className="text-lg font-bold text-white">FinArc</span>
            <p className="text-[10px] leading-none text-slate-400">
              FinOps & Cost Management
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
              className={cn(
                "sidebar-link",
                isActive && "sidebar-link-active",
                collapsed && "sidebar-link-collapsed"
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <div className="px-3 pb-1">
        <button
          onClick={toggle}
          title={collapsed ? "Expandir" : "Colapsar"}
          className={cn(
            "sidebar-link w-full",
            collapsed && "sidebar-link-collapsed"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4.5 w-4.5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4.5 w-4.5 shrink-0" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>

      {/* Logout */}
      <div className="border-t border-slate-700 p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10",
            collapsed && "sidebar-link-collapsed"
          )}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
