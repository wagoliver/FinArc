"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight, Home } from "lucide-react";
import { flatNavItems } from "@/lib/constants";
import Link from "next/link";

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const allNav = flatNavItems();

  const currentNav = allNav.find(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((segment, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const nav = allNav.find((item) => item.href === href);
    const label = nav?.title || segment.charAt(0).toUpperCase() + segment.slice(1);
    return { label, href, isLast: idx === segments.length - 1 };
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-sm">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-text-muted transition-colors hover:text-text-primary"
        >
          <Home className="h-4 w-4" />
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            {crumb.isLast ? (
              <span className="flex items-center gap-1.5 font-medium text-text-primary">
                {currentNav && crumb.isLast && (
                  <currentNav.icon className="h-4 w-4 text-accent-purple" />
                )}
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-text-muted transition-colors hover:text-text-primary"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

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
    </header>
  );
}
