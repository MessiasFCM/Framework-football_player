import { supabase } from "@/lib/supabaseClient";

export interface OverviewPlayer {
  id_jogador: number | null;
  nome: string;
  squad: string;
  posicao: string;
  foto_url: string | null;
  gols: number;
  assistencias: number;
  xg: number;
  xag: number;
}

export interface OverviewData {
  total_players: number;
  total_teams: number;
  total_leagues: number;
  total_nations: number;
  positions: Record<string, number>;
  top_scorers: OverviewPlayer[];
  top_assists: OverviewPlayer[];
}

const POSITIONS = ["FW", "MF", "DF", "GK"] as const;
const PAGE_SIZE = 1000;

async function count(
  table: string,
  apply?: (q: ReturnType<typeof buildCountQuery>) => typeof q
): Promise<number> {
  let q = buildCountQuery(table);
  if (apply) q = apply(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

function buildCountQuery(table: string) {
  return supabase.from(table).select("*", { count: "exact", head: true });
}

async function countNations(totalPlayers: number): Promise<number> {
  const pages = Math.max(1, Math.ceil(totalPlayers / PAGE_SIZE));
  const requests = Array.from({ length: pages }, (_, i) =>
    supabase
      .from("JOGADOR")
      .select("nacionalidade")
      .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)
  );
  const results = await Promise.all(requests);
  const nations = new Set<string>();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const row of data ?? []) {
      const nac = (row as { nacionalidade: string | null }).nacionalidade;
      if (nac) nations.add(nac);
    }
  }
  return nations.size;
}

async function topBy(metric: "gols" | "assistencias"): Promise<OverviewPlayer[]> {
  const { data, error } = await supabase
    .from("ESTATISTICA")
    .select("gols,assistencias,xg,xag,JOGADOR(id_jogador,nome,posicao,foto_url,CLUBE(nome))")
    .order(metric, { ascending: false })
    .limit(5);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const jogador = (Array.isArray(r.JOGADOR) ? r.JOGADOR[0] : r.JOGADOR) as
      | {
          id_jogador?: number;
          nome?: string;
          posicao?: string;
          foto_url?: string | null;
          CLUBE?: { nome?: string } | { nome?: string }[];
        }
      | undefined;
    const clube = Array.isArray(jogador?.CLUBE) ? jogador?.CLUBE[0] : jogador?.CLUBE;
    return {
      id_jogador: jogador?.id_jogador ?? null,
      nome: jogador?.nome ?? "—",
      squad: clube?.nome ?? "—",
      posicao: jogador?.posicao ?? "—",
      foto_url: jogador?.foto_url ?? null,
      gols: Number(r.gols ?? 0),
      assistencias: Number(r.assistencias ?? 0),
      xg: Number(r.xg ?? 0),
      xag: Number(r.xag ?? 0),
    };
  });
}

export async function getOverview(): Promise<OverviewData> {
  const [totalPlayers, totalTeams, totalLeagues, posCounts, topScorers, topAssists] =
    await Promise.all([
      count("JOGADOR"),
      count("CLUBE"),
      count("LIGA"),
      Promise.all(
        POSITIONS.map((p) => count("JOGADOR", (q) => q.like("posicao", `${p}%`)))
      ),
      topBy("gols"),
      topBy("assistencias"),
    ]);

  const positions: Record<string, number> = {};
  POSITIONS.forEach((p, i) => {
    positions[p] = posCounts[i];
  });

  const totalNations = await countNations(totalPlayers);

  return {
    total_players: totalPlayers,
    total_teams: totalTeams,
    total_leagues: totalLeagues,
    total_nations: totalNations,
    positions,
    top_scorers: topScorers,
    top_assists: topAssists,
  };
}
