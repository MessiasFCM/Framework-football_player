import { supabase } from "@/lib/supabaseClient";
import type { Estatistica } from "./types";

const TABLE = "ESTATISTICA";

export async function getEstatisticas() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  return data as Estatistica[];
}

export async function getEstatisticaById(id: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_estatistica", id)
    .single();
  if (error) throw error;
  return data as Estatistica;
}

export async function getEstatisticasByJogador(idJogador: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_jogador", idJogador);
  if (error) throw error;
  return data as Estatistica[];
}

export async function createEstatistica(
  estatistica: Omit<Estatistica, "id_estatistica">
) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(estatistica)
    .select()
    .single();
  if (error) throw error;
  return data as Estatistica;
}

export async function updateEstatistica(
  id: number,
  estatistica: Partial<Omit<Estatistica, "id_estatistica">>
) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(estatistica)
    .eq("id_estatistica", id)
    .select()
    .single();
  if (error) throw error;
  return data as Estatistica;
}

export async function deleteEstatistica(id: number) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id_estatistica", id);
  if (error) throw error;
}
