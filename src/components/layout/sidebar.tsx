"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border-glass bg-surface-1/60 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue">
          <span className="text-base font-bold text-white">F</span>
        </div>
        <div>
          <span className="text-lg font-bold text-text-primary">FinArc</span>
          <p className="text-[10px] leading-none text-text-muted">
            FinOps & Cost Management
          </p>
        </div>
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
              className={cn(
                "sidebar-link",
                isActive && "sidebar-link-active"
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-border-glass p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="sidebar-link w-full text-danger/80 hover:text-danger hover:bg-danger/10"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
