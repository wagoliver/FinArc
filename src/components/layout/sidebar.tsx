"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LogOut, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { signOut } from "next-auth/react";
import { useSidebar } from "./sidebar-context";

function isChildActive(item: NavItem, pathname: string): boolean {
  if (item.children) {
    return item.children.some(
      (child) =>
        pathname === child.href || pathname.startsWith(child.href + "/")
    );
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Auto-open groups that contain the active route
    const open = new Set<string>();
    for (const item of NAV_ITEMS) {
      if (item.children && isChildActive(item, pathname)) {
        open.add(item.title);
      }
    }
    return open;
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

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
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          if (item.children) {
            const isOpen = openGroups.has(item.title);
            const hasActive = isChildActive(item, pathname);

            // Collapsed: show only parent icon, clicking goes to first child
            if (collapsed) {
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  title={item.title}
                  className={cn(
                    "sidebar-link sidebar-link-collapsed",
                    hasActive && "sidebar-link-active"
                  )}
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                </Link>
              );
            }

            // Expanded: show group header + children
            return (
              <div key={item.title}>
                <button
                  onClick={() => toggleGroup(item.title)}
                  className={cn(
                    "sidebar-link w-full",
                    hasActive && !isOpen && "sidebar-link-active"
                  )}
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="flex-1 text-left">{item.title}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="ml-3 mt-1 space-y-0.5 border-l border-slate-600 pl-3">
                    {item.children.map((child) => {
                      const isActive =
                        pathname === child.href ||
                        pathname.startsWith(child.href + "/");

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "sidebar-link text-[13px]",
                            isActive && "sidebar-link-active"
                          )}
                        >
                          <child.icon className="h-4 w-4 shrink-0" />
                          <span>{child.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Regular item (no children)
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
      <div className="px-3 pb-2">
        <button
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
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
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>

      {/* Logout — separated with extra spacing */}
      <div className="border-t border-slate-700 p-3 pt-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Sair da conta" : undefined}
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
