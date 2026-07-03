"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { useAuth } from "@/lib/authContext";

const PUBLIC_ROUTES = ["/login"];

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace("/login");
    }
  }, [loading, user, isPublicRoute, router]);

  if (isPublicRoute) return <>{children}</>;
  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onMobileClose={() => setMobileOpen(false)}
        />
      </div>

      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-200 max-lg:!ml-0"
        style={{ marginLeft: collapsed ? "4rem" : "15rem" }}
      >
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={22} className="text-gray-600" />
          </button>
          <span className="font-bold text-gray-900">FutAnalytics</span>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
