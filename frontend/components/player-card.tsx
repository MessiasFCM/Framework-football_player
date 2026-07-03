"use client";

import { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { BadgeImg } from "@/components/badge-img";

interface PlayerCardProps {
  name: string;
  squad: string;
  position: string;
  nationality?: string;
  photoUrl?: string | null;
  escudoUrl?: string | null;
  bandeiraUrl?: string | null;
  stats?: { label: string; value: string | number }[];
  score?: number;
  rank?: number;
  onClick?: () => void;
  href?: string;
}

const posTheme: Record<
  string,
  { badge: string; ring: string; border: string; stat: string }
> = {
  GK: {
    badge: "bg-yellow-100 text-yellow-700",
    ring: "ring-yellow-200",
    border: "group-hover:border-yellow-300",
    stat: "group-hover:bg-yellow-50",
  },
  DF: {
    badge: "bg-blue-100 text-blue-700",
    ring: "ring-blue-200",
    border: "group-hover:border-blue-300",
    stat: "group-hover:bg-blue-50",
  },
  MF: {
    badge: "bg-purple-100 text-purple-700",
    ring: "ring-purple-200",
    border: "group-hover:border-purple-300",
    stat: "group-hover:bg-purple-50",
  },
  FW: {
    badge: "bg-red-100 text-red-700",
    ring: "ring-red-200",
    border: "group-hover:border-red-300",
    stat: "group-hover:bg-red-50",
  },
};

const defaultTheme = {
  badge: "bg-gray-100 text-gray-700",
  ring: "ring-gray-200",
  border: "group-hover:border-gray-300",
  stat: "group-hover:bg-gray-50",
};

const medalTheme: Record<number, string> = {
  1: "bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950",
  2: "bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700",
  3: "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950",
};

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <div
      className={clsx(
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 shadow-sm",
        medalTheme[rank] ?? "bg-gray-100 text-gray-400"
      )}
    >
      {rank}
    </div>
  );
}

function PlayerAvatar({
  name,
  photoUrl,
  badge,
  ring,
}: {
  name: string;
  photoUrl?: string | null;
  badge: string;
  ring: string;
}) {
  const [failed, setFailed] = useState(false);

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setFailed(true)}
        className={clsx("w-12 h-12 rounded-xl object-cover shrink-0 bg-gray-100 ring-2", ring)}
      />
    );
  }

  return (
    <div
      className={clsx(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ring-2",
        badge,
        ring
      )}
    >
      {initials(name)}
    </div>
  );
}

export function PlayerCard({
  name,
  squad,
  position,
  nationality,
  photoUrl,
  escudoUrl,
  bandeiraUrl,
  stats,
  score,
  rank,
  onClick,
  href,
}: PlayerCardProps) {
  const pos = position?.split(",")[0]?.trim() ?? "—";
  const theme = posTheme[pos] ?? defaultTheme;
  const clickable = Boolean(onClick || href);

  const card = (
    <div
      onClick={onClick}
      className={clsx(
        "group relative bg-white rounded-2xl border border-gray-100 p-4 shadow-sm overflow-hidden transition-all duration-200",
        clickable && clsx("cursor-pointer hover:shadow-lg hover:-translate-y-0.5", theme.border)
      )}
    >
      <div className="flex items-start gap-3">
        {rank !== undefined && <RankBadge rank={rank} />}

        <PlayerAvatar name={name} photoUrl={photoUrl} badge={theme.badge} ring={theme.ring} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate group-hover:text-brand-700 transition-colors">
              {name}
            </p>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", theme.badge)}>
              {pos}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <BadgeImg src={escudoUrl} alt={squad} className="w-4 h-4 object-contain shrink-0" />
            <span>{squad}</span>
            {nationality && (
              <>
                <span className="text-gray-300">·</span>
                <BadgeImg src={bandeiraUrl} alt={nationality} className="w-4 h-3 object-cover rounded-sm shrink-0" />
                <span>{nationality}</span>
              </>
            )}
          </p>
        </div>

        {score !== undefined && (
          <div className="shrink-0 text-center bg-brand-50 rounded-lg px-2.5 py-1.5">
            <p className="text-[10px] text-brand-400 font-medium uppercase tracking-wide">Score</p>
            <p className="text-sm font-bold text-brand-700">{score.toFixed(3)}</p>
          </div>
        )}
      </div>

      {stats && stats.length > 0 && (
        <div className="flex gap-1.5 mt-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className={clsx(
                "flex-1 text-center bg-gray-50 rounded-lg px-2 py-1.5 transition-colors",
                theme.stat
              )}
            >
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{s.label}</p>
              <p className="text-sm font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }

  return card;
}
