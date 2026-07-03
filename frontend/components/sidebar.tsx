"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Search,
  Users,
  Network,
  GitCompareArrows,
  Trophy,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";

function BrandIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#16a34a"/>
      <rect x="6"  y="18" width="4" height="8"  rx="1" fill="white"/>
      <rect x="14" y="12" width="4" height="14" rx="1" fill="white"/>
      <rect x="22" y="6"  width="4" height="20" rx="1" fill="white"/>
    </svg>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
}

const nav = [
  { label: "Overview",           href: "/",                  icon: LayoutDashboard },
  { label: "Jogadores",          href: "/players",           icon: Users },
  { label: "Busca por Perfil",   href: "/search",            icon: Search },
  { label: "Recomendar Similares", href: "/recommend",       icon: Network },
  { type: "divider", label: "Relatórios" },
  { label: "Ranking",            href: "/reports/ranking",   icon: Trophy },
  { label: "Similaridade",       href: "/reports/similarity",icon: GitCompareArrows },
];

export function Sidebar({ collapsed, onToggle, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-40 bg-zinc-900 flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={clsx(
          "flex items-center gap-2 px-4 py-5 border-b border-zinc-700 overflow-hidden",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="shrink-0">
          <BrandIcon size={32} />
        </div>
        {!collapsed && (
          <span className="text-white font-bold text-lg tracking-tight whitespace-nowrap">
            FutAnalytics
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
        {nav.map((item, i) => {
          if (item.type === "divider") {
            return collapsed ? (
              <div key={i} className="my-2 border-t border-zinc-700 mx-2" />
            ) : (
              <p
                key={i}
                className="px-2 pt-5 pb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap"
              >
                {item.label}
              </p>
            );
          }

          const Icon = item.icon!;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href!}
              title={collapsed ? item.label : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0 py-3" : "px-3 py-2.5",
                active
                  ? "bg-brand-600 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-700 p-3">
        {user ? (
          <div className={clsx("flex items-center gap-2", collapsed && "flex-col")}>
            <div
              className={clsx(
                "flex items-center gap-2 flex-1 min-w-0",
                collapsed && "flex-col"
              )}
              title={user.email}
            >
              <UserCircle size={20} className="text-zinc-400 shrink-0" />
              {!collapsed && (
                <span className="text-sm text-zinc-200 truncate">{user.nome ?? user.email}</span>
              )}
            </div>
            <button
              onClick={signOut}
              title="Sair"
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            title={collapsed ? "Entrar" : undefined}
            className={clsx(
              "flex items-center gap-2 text-zinc-400 hover:text-white text-sm rounded-lg py-2 px-2 hover:bg-zinc-800 transition-colors",
              collapsed && "justify-center"
            )}
          >
            <LogIn size={18} />
            {!collapsed && <span>Entrar</span>}
          </Link>
        )}
      </div>

      <div className="border-t border-zinc-700 p-3">
        <button
          onClick={onToggle}
          className={clsx(
            "w-full flex items-center gap-2 text-zinc-400 hover:text-white text-sm rounded-lg py-2 px-2 hover:bg-zinc-800 transition-colors",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : (
            <>
              <ChevronLeft size={18} />
              <span className="text-xs">Minimizar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
