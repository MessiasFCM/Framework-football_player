import { supabase } from "@/lib/supabaseClient";
import type { Jogador, Estatistica } from "./types";
import { getBandeirasPorCodigo } from "./nacionalidadeService";

const TABLE = "JOGADOR";

/** Item enxuto usado na listagem de jogadores (já com clube, liga e stats principais). */
export interface JogadorListItem {
  id_jogador: number;
  nome: string;
  nacionalidade: string | null;
  idade: number | null;
  posicao: string | null;
  id_clube: number | null;
  foto_url: string | null;
  clube: string;
  liga: string;
  escudo_url: string | null;
  bandeira_url: string | null;
  gols: number | null;
  assistencias: number | null;
  xg: number | null;
}

export interface JogadorFiltros {
  nome?: string;
  /** Prefixo da posição: "FW" | "MF" | "DF" | "GK". */
  posicao?: string;
  idClube?: number;
  idLiga?: number;
  ordenarPor?: "nome" | "idade";
  limit?: number;
  offset?: number;
}

export interface JogadoresPagina {
  jogadores: JogadorListItem[];
  total: number;
}

export interface JogadorPerfil {
  id_jogador: number;
  nome: string;
  nacionalidade: string | null;
  idade: number | null;
  ano_nascimento: number | null;
  posicao: string | null;
  id_clube: number | null;
  foto_url: string | null;
  clube: string;
  liga: string;
  pais_liga: string;
  escudo_url: string | null;
  logo_liga_url: string | null;
  bandeira_url: string | null;
  estatisticas: Estatistica[];
}

type EmbeddedLiga = { nome?: string; pais?: string; logo_url?: string | null };
type EmbeddedClube = {
  nome?: string;
  id_liga?: number | null;
  escudo_url?: string | null;
  LIGA?: EmbeddedLiga | EmbeddedLiga[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export async function getJogadores() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  return data as Jogador[];
}

export async function getJogadoresFiltrados(
  filtros: JogadorFiltros = {}
): Promise<JogadoresPagina> {
  const {
    nome,
    posicao,
    idClube,
    idLiga,
    ordenarPor = "nome",
    limit = 30,
    offset = 0,
  } = filtros;

  const clubeEmbed = idLiga
    ? "CLUBE!inner(nome,escudo_url,id_liga,LIGA(nome,pais))"
    : "CLUBE(nome,escudo_url,id_liga,LIGA(nome,pais))";

  let query = supabase
    .from(TABLE)
    .select(
      `id_jogador,nome,nacionalidade,idade,posicao,id_clube,foto_url,${clubeEmbed},ESTATISTICA(gols,assistencias,xg)`,
      { count: "exact" }
    );

  if (nome) query = query.ilike("nome", `%${nome}%`);
  if (posicao) query = query.like("posicao", `${posicao}%`);
  if (idClube) query = query.eq("id_clube", idClube);
  if (idLiga) query = query.eq("CLUBE.id_liga", idLiga);

  query = query
    .order(ordenarPor, { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const jogadores: JogadorListItem[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const clube = first(r.CLUBE as EmbeddedClube | EmbeddedClube[] | undefined);
    const liga = first(clube?.LIGA);
    const est = first(
      r.ESTATISTICA as
        | { gols?: number; assistencias?: number; xg?: number }
        | { gols?: number; assistencias?: number; xg?: number }[]
        | undefined
    );
    return {
      id_jogador: Number(r.id_jogador),
      nome: String(r.nome ?? "—"),
      nacionalidade: (r.nacionalidade as string | null) ?? null,
      idade: (r.idade as number | null) ?? null,
      posicao: (r.posicao as string | null) ?? null,
      id_clube: (r.id_clube as number | null) ?? null,
      foto_url: (r.foto_url as string | null) ?? null,
      clube: clube?.nome ?? "—",
      liga: liga?.nome ?? "—",
      escudo_url: clube?.escudo_url ?? null,
      bandeira_url: null,
      gols: est?.gols ?? null,
      assistencias: est?.assistencias ?? null,
      xg: est?.xg ?? null,
    };
  });

  const codigos = jogadores
    .map((j) => j.nacionalidade)
    .filter((c): c is string => Boolean(c));
  try {
    const bandeiras = await getBandeirasPorCodigo(codigos);
    for (const j of jogadores) {
      if (j.nacionalidade) j.bandeira_url = bandeiras[j.nacionalidade] ?? null;
    }
  } catch {
  }

  return { jogadores, total: count ?? 0 };
}

export async function getJogadorPerfil(id: number): Promise<JogadorPerfil> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*,CLUBE(nome,escudo_url,id_liga,LIGA(nome,pais,logo_url)),ESTATISTICA(*)")
    .eq("id_jogador", id)
    .single();
  if (error) throw error;

  const r = data as Record<string, unknown>;
  const clube = first(r.CLUBE as EmbeddedClube | EmbeddedClube[] | undefined);
  const liga = first(clube?.LIGA);
  const estatisticas = (
    Array.isArray(r.ESTATISTICA) ? r.ESTATISTICA : r.ESTATISTICA ? [r.ESTATISTICA] : []
  ) as Estatistica[];

  const nacionalidade = (r.nacionalidade as string | null) ?? null;
  let bandeira_url: string | null = null;
  if (nacionalidade) {
    try {
      const bandeiras = await getBandeirasPorCodigo([nacionalidade]);
      bandeira_url = bandeiras[nacionalidade] ?? null;
    } catch {}
  }

  return {
    id_jogador: Number(r.id_jogador),
    nome: String(r.nome ?? "—"),
    nacionalidade,
    idade: (r.idade as number | null) ?? null,
    ano_nascimento: (r.ano_nascimento as number | null) ?? null,
    posicao: (r.posicao as string | null) ?? null,
    id_clube: (r.id_clube as number | null) ?? null,
    foto_url: (r.foto_url as string | null) ?? null,
    clube: clube?.nome ?? "—",
    liga: liga?.nome ?? "—",
    pais_liga: liga?.pais ?? "—",
    escudo_url: clube?.escudo_url ?? null,
    logo_liga_url: liga?.logo_url ?? null,
    bandeira_url,
    estatisticas,
  };
}

export async function getIdMapByNomes(nomes: string[]): Promise<Map<string, number>> {
  if (nomes.length === 0) return new Map();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id_jogador,nome")
    .in("nome", nomes);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const r of data ?? []) map.set(r.nome, r.id_jogador);
  return map;
}

export async function getJogadorById(id: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_jogador", id)
    .single();
  if (error) throw error;
  return data as Jogador;
}

export async function getJogadoresByClube(idClube: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_clube", idClube);
  if (error) throw error;
  return data as Jogador[];
}

export async function createJogador(jogador: Omit<Jogador, "id_jogador">) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(jogador)
    .select()
    .single();
  if (error) throw error;
  return data as Jogador;
}

export async function updateJogador(
  id: number,
  jogador: Partial<Omit<Jogador, "id_jogador">>
) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(jogador)
    .eq("id_jogador", id)
    .select()
    .single();
  if (error) throw error;
  return data as Jogador;
}

export async function deleteJogador(id: number) {
  const { error } = await supabase.from(TABLE).delete().eq("id_jogador", id);
  if (error) throw error;
}
