import { supabase } from "@/lib/supabaseClient";

type Embedded<T> = T | T[] | null | undefined;
function first<T>(v: Embedded<T>): T | undefined {
  return Array.isArray(v) ? v[0] : v ?? undefined;
}

export type PlayerShape = Record<string, string | number | null>;

export interface SimilaridadeResultado {
  player: PlayerShape;
  similar_players: PlayerShape[];
}

const JOGADOR_SELECT = `
  id_jogador, nome, posicao, nacionalidade, foto_url,
  CLUBE(nome),
  ESTATISTICA(gols, assistencias, xg, xag, conducoes_prog, passes_prog, minutos, partidas)
`;

type JogadorRow = {
  id_jogador: number;
  nome: string | null;
  posicao: string | null;
  nacionalidade: string | null;
  foto_url: string | null;
  CLUBE?: Embedded<{ nome?: string }>;
  ESTATISTICA?: Embedded<{
    gols?: number; assistencias?: number; xg?: number; xag?: number;
    conducoes_prog?: number; passes_prog?: number; minutos?: number; partidas?: number;
  }>;
};

function toPlayerShape(j: JogadorRow, distancia?: number): PlayerShape {
  const clube = first(j.CLUBE);
  const est = first(j.ESTATISTICA);
  const shape: PlayerShape = {
    id_jogador: j.id_jogador,
    Player: j.nome ?? "—",
    Squad: clube?.nome ?? "—",
    Pos: j.posicao ?? "—",
    Nation: j.nacionalidade ?? null,
    photo_url: j.foto_url ?? null,
    Gls: est?.gols ?? null,
    Ast: est?.assistencias ?? null,
    xG: est?.xg ?? null,
    xAG: est?.xag ?? null,
    PrgC: est?.conducoes_prog ?? null,
    PrgP: est?.passes_prog ?? null,
    Min: est?.minutos ?? null,
    MP: est?.partidas ?? null,
  };
  if (distancia != null) shape.distance = distancia;
  return shape;
}

export async function getSimilaresPorNome(
  nome: string,
  topK = 10
): Promise<SimilaridadeResultado> {
  const { data: refData, error: refErr } = await supabase
    .from("JOGADOR")
    .select(JOGADOR_SELECT)
    .ilike("nome", nome) 
    .limit(1)
    .maybeSingle();
  if (refErr) throw refErr;
  if (!refData) throw new Error("Jogador não encontrado.");
  const ref = refData as unknown as JogadorRow;

  const { data: simData, error: simErr } = await supabase
    .from("SIMILARIDADE")
    .select(`distancia, posicao, similar:JOGADOR!id_jogador_similar(${JOGADOR_SELECT})`)
    .eq("id_jogador_origem", ref.id_jogador)
    .order("posicao")
    .limit(topK);
  if (simErr) throw simErr;

  const similar_players = (simData ?? [])
    .map((row) => {
      const r = row as unknown as { distancia: number; similar: Embedded<JogadorRow> };
      const sim = first(r.similar);
      return sim ? toPlayerShape(sim, r.distancia) : null;
    })
    .filter((p): p is PlayerShape => p !== null);

  return { player: toPlayerShape(ref), similar_players };
}
