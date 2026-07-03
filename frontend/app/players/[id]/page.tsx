import { notFound } from "next/navigation";
import { Shield, Trophy, Globe, Calendar } from "lucide-react";
import { getJogadorPerfil } from "@/services";
import type { JogadorPerfil } from "@/services";
import { PlayerSeason } from "@/components/player-season";
import { PlayerAvatarHero } from "@/components/player-avatar-hero";
import { BadgeImg } from "@/components/badge-img";
import { BackButton } from "@/components/back-button";

export const dynamic = "force-dynamic";

const posColors: Record<string, string> = {
  GK: "bg-yellow-100 text-yellow-700",
  DF: "bg-blue-100 text-blue-700",
  MF: "bg-purple-100 text-purple-700",
  FW: "bg-red-100 text-red-700",
};

const posGradient: Record<string, string> = {
  GK: "from-yellow-500 to-amber-600",
  DF: "from-blue-500 to-indigo-600",
  MF: "from-purple-500 to-fuchsia-600",
  FW: "from-red-500 to-rose-600",
};

const posLabel: Record<string, string> = {
  GK: "Goleiro",
  DF: "Defensor",
  MF: "Meio-campista",
  FW: "Atacante",
};

export default async function PlayerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let jogador: JogadorPerfil;
  try {
    jogador = await getJogadorPerfil(id);
  } catch {
    notFound();
  }

  const pos = jogador.posicao?.split(",")[0]?.trim() ?? "—";
  const posColor = posColors[pos] ?? "bg-gray-100 text-gray-700";
  const gradient = posGradient[pos] ?? "from-gray-500 to-gray-700";

  const totalGols = jogador.estatisticas.reduce((s, e) => s + (e.gols ?? 0), 0);
  const totalAssist = jogador.estatisticas.reduce((s, e) => s + (e.assistencias ?? 0), 0);
  const totalPartidas = jogador.estatisticas.reduce((s, e) => s + (e.partidas ?? 0), 0);

  return (
    <div className="p-8">
      <BackButton />

      {/* Hero */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className={`h-20 bg-gradient-to-r ${gradient}`} />
        <div className="px-6 pb-6">
          {/* Avatar sobreposto à faixa */}
          <PlayerAvatarHero nome={jogador.nome} fotoUrl={jogador.foto_url} gradient={gradient} />

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {jogador.nome}
                </h1>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${posColor}`}>
                  {posLabel[pos] ?? jogador.posicao ?? "—"}
                </span>
              </div>
              <p className="text-gray-500 mt-1">
                {jogador.clube} · {jogador.liga}
                {jogador.posicao ? ` · ${jogador.posicao}` : ""}
              </p>
            </div>

            {/* Resumo de carreira */}
            <div className="flex gap-8 shrink-0">
              <CareerStat label="Jogos" value={totalPartidas} />
              <CareerStat label="Gols" value={totalGols} />
              <CareerStat label="Assist." value={totalAssist} />
            </div>
          </div>

          {/* Infos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 border-t border-gray-100 pt-5">
            <Info icon={Shield} label="Time" value={jogador.clube} imgUrl={jogador.escudo_url} />
            <Info
              icon={Trophy}
              label="Liga"
              value={jogador.liga}
              sub={jogador.pais_liga}
              imgUrl={jogador.logo_liga_url}
            />
            <Info
              icon={Globe}
              label="Nacionalidade"
              value={jogador.nacionalidade ?? "—"}
              imgUrl={jogador.bandeira_url}
            />
            <Info
              icon={Calendar}
              label="Idade"
              value={jogador.idade != null ? `${jogador.idade} anos` : "—"}
              sub={jogador.ano_nascimento ? `Nasc. ${jogador.ano_nascimento}` : undefined}
            />
          </div>
        </div>
      </div>

      {/* Estatísticas por temporada */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Estatísticas por temporada
      </h2>

      {jogador.estatisticas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-gray-400 text-sm">
          Nenhuma estatística registrada para este jogador.
        </div>
      ) : (
        <div className="space-y-6">
          {jogador.estatisticas
            .slice()
            .sort((a, b) => b.temporada.localeCompare(a.temporada))
            .map((est) => (
              <PlayerSeason key={est.id_estatistica} est={est} />
            ))}
        </div>
      )}
    </div>
  );
}

function CareerStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  sub,
  imgUrl,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
  sub?: string;
  imgUrl?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 overflow-hidden">
        <Icon size={18} className="text-brand-600" />
        <BadgeImg
          src={imgUrl}
          alt={value}
          className="absolute inset-0 w-full h-full object-contain bg-white p-1"
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}
