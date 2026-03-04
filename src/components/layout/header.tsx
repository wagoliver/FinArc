"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, ChevronRight } from "lucide-react";
import { flatNavItems } from "@/lib/constants";

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const allNav = flatNavItems();

  const currentNav = allNav.find(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const breadcrumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const nav = allNav.find((item) => item.href === `/${segment}`);
      return nav?.title || segment.charAt(0).toUpperCase() + segment.slice(1);
    });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        {currentNav && (
          <currentNav.icon className="h-5 w-5 text-blue-600" />
        )}
        <div className="flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
              )}
              <span
                className={
                  i === breadcrumbs.length - 1
                    ? "font-medium text-text-primary"
                    : "text-text-muted"
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative rounded-xl p-2 text-text-secondary hover:bg-slate-100 hover:text-text-primary">
          <Bell className="h-5 w-5" />
        </button>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {session?.user?.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "?"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-text-primary">
              {session?.user?.name || "Usuário"}
            </p>
            <p className="text-xs text-text-muted">
              {session?.user?.email}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
