"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/layout/session-provider";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";

function AppContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen bg-surface-0">
      <Sidebar />
      <div
        className={`flex flex-1 flex-col transition-all duration-200 ${
          collapsed ? "pl-16" : "pl-64"
        }`}
      >
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <AppContent>{children}</AppContent>
      </SidebarProvider>
    </SessionProvider>
  );
}
