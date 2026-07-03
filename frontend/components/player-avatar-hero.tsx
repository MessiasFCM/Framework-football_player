"use client";

import { useState } from "react";

interface PlayerAvatarHeroProps {
  nome: string;
  fotoUrl: string | null;
  gradient: string;
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PlayerAvatarHero({ nome, fotoUrl, gradient }: PlayerAvatarHeroProps) {
  const [failed, setFailed] = useState(false);

  if (fotoUrl && !failed) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        onError={() => setFailed(true)}
        className="w-24 h-24 rounded-2xl object-cover shadow-md ring-4 ring-white -mt-12 mb-4 bg-gray-100"
      />
    );
  }

  return (
    <div
      className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-3xl font-bold shadow-md ring-4 ring-white -mt-12 mb-4`}
    >
      {initials(nome)}
    </div>
  );
}
