import { Users, Globe, Shield, Trophy, LayoutDashboard } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PlayerCard } from "@/components/player-card";
import { getOverview } from "@/services";

export const dynamic = "force-dynamic";

const posLabel: Record<string, string> = { FW: "Atacantes", MF: "Meias", DF: "Defensores", GK: "Goleiros" };

export default async function HomePage() {
  const d = await getOverview();
  const totalPos = Object.values(d.positions).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <LayoutDashboard size={22} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <p className="text-gray-500">Visão geral · 10 grandes ligas · Temporada 2024-25</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total de Jogadores" value={d.total_players.toLocaleString("pt-BR")} icon={Users} color="green" />
        <StatCard label="Times" value={d.total_teams} icon={Shield} color="blue" />
        <StatCard label="Nacionalidades" value={d.total_nations} icon={Globe} color="purple" />
        <StatCard label="Ligas" value={d.total_leagues} icon={Trophy} color="orange" sub="Principais ligas do mundo" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Distribuição por Posição
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(d.positions).map(([pos, count]) => {
            const pct = Math.round((count / totalPos) * 100);
            return (
              <div key={pos}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">{posLabel[pos] ?? pos}</span>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Top 5 Artilheiros
          </h2>
          <div className="space-y-2">
            {d.top_scorers.map((p, i) => (
              <PlayerCard
                key={`${p.nome}-${i}`}
                href={p.id_jogador != null ? `/players/${p.id_jogador}` : undefined}
                name={p.nome}
                squad={p.squad}
                position={p.posicao}
                photoUrl={p.foto_url}
                rank={i + 1}
                stats={[
                  { label: "Gols", value: p.gols },
                  { label: "Assist.", value: p.assistencias },
                  { label: "xG", value: p.xg.toFixed(1) },
                ]}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Top 5 Assistências
          </h2>
          <div className="space-y-2">
            {d.top_assists.map((p, i) => (
              <PlayerCard
                key={`${p.nome}-${i}`}
                href={p.id_jogador != null ? `/players/${p.id_jogador}` : undefined}
                name={p.nome}
                squad={p.squad}
                position={p.posicao}
                photoUrl={p.foto_url}
                rank={i + 1}
                stats={[
                  { label: "Assist.", value: p.assistencias },
                  { label: "Gols", value: p.gols },
                  { label: "xAG", value: p.xag.toFixed(1) },
                ]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
