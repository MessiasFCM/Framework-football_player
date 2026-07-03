import { supabase } from "@/lib/supabaseClient";
import type { PlayerShape } from "./recomendacaoService";

type Embedded<T> = T | T[] | null | undefined;
function first<T>(v: Embedded<T>): T | undefined {
  return Array.isArray(v) ? v[0] : v ?? undefined;
}


export const RANKING_METRICS = [
  { value: "Gls", label: "Gols", coluna: "gols" },
  { value: "Ast", label: "Assistências", coluna: "assistencias" },
  { value: "xG", label: "xG", coluna: "xg" },
  { value: "xAG", label: "xAG", coluna: "xag" },
  { value: "PrgC", label: "Progressão (conduções)", coluna: "conducoes_prog" },
  { value: "PrgP", label: "Progressão (passes)", coluna: "passes_prog" },
  { value: "PrgR", label: "Progressão (recepções)", coluna: "recepcoes_prog" },
  { value: "Min", label: "Minutos", coluna: "minutos" },
  { value: "MP", label: "Partidas", coluna: "partidas" },
] as const;

export type RankingMetric = (typeof RANKING_METRICS)[number]["value"];

const COLUNA_POR_METRICA: Record<string, string> = Object.fromEntries(
  RANKING_METRICS.map((m) => [m.value, m.coluna])
);

type EstatisticaRow = {
  partidas: number | null;
  minutos: number | null;
  gols: number | null;
  assistencias: number | null;
  xg: number | null;
  xag: number | null;
  conducoes_prog: number | null;
  passes_prog: number | null;
  recepcoes_prog: number | null;
  JOGADOR: Embedded<{
    id_jogador: number;
    nome: string | null;
    posicao: string | null;
    nacionalidade: string | null;
    idade: number | null;
    foto_url: string | null;
    CLUBE?: Embedded<{ nome?: string }>;
  }>;
};

function toPlayerShape(row: EstatisticaRow): PlayerShape | null {
  const j = first(row.JOGADOR);
  if (!j) return null;
  const clube = first(j.CLUBE);
  return {
    id_jogador: j.id_jogador,
    Player: j.nome ?? "—",
    Squad: clube?.nome ?? "—",
    Pos: j.posicao ?? "—",
    Nation: j.nacionalidade ?? null,
    Age: j.idade ?? null,
    photo_url: j.foto_url ?? null,
    Gls: row.gols ?? null,
    Ast: row.assistencias ?? null,
    xG: row.xg ?? null,
    xAG: row.xag ?? null,
    PrgC: row.conducoes_prog ?? null,
    PrgP: row.passes_prog ?? null,
    PrgR: row.recepcoes_prog ?? null,
    Min: row.minutos ?? null,
    MP: row.partidas ?? null,
  };
}

export async function getRanking(
  metric: RankingMetric,
  topK = 20,
  posicao?: string
): Promise<PlayerShape[]> {
  const coluna = COLUNA_POR_METRICA[metric] ?? "gols";

  let query = supabase
    .from("ESTATISTICA")
    .select(
      `partidas, minutos, gols, assistencias, xg, xag, conducoes_prog, passes_prog, recepcoes_prog,
       JOGADOR!inner(id_jogador, nome, posicao, nacionalidade, idade, foto_url, CLUBE(nome))`
    )
    .not(coluna, "is", null)
    .order(coluna, { ascending: false, nullsFirst: false });

  if (posicao) query = query.like("JOGADOR.posicao", `${posicao}%`);

  query = query.limit(topK * 3);

  const { data, error } = await query;
  if (error) throw error;

  const ranking: PlayerShape[] = [];
  const vistos = new Set<number>();
  for (const row of (data ?? []) as unknown as EstatisticaRow[]) {
    const shape = toPlayerShape(row);
    if (!shape) continue;
    const id = Number(shape.id_jogador);
    if (vistos.has(id)) continue; 
    vistos.add(id);
    ranking.push(shape);
    if (ranking.length >= topK) break;
  }

  return ranking;
}
