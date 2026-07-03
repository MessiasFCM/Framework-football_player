import { supabase } from "@/lib/supabaseClient";
import type { Pesquisa } from "./types";

const TABLE = "PESQUISA";

export async function getPesquisas() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  return data as Pesquisa[];
}

export async function getPesquisaById(id: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_pesquisa", id)
    .single();
  if (error) throw error;
  return data as Pesquisa;
}

export async function getPesquisasByUsuario(idUsuario: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_usuario", idUsuario);
  if (error) throw error;
  return data as Pesquisa[];
}

export async function createPesquisa(
  pesquisa: Omit<Pesquisa, "id_pesquisa" | "data_hora">
) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(pesquisa)
    .select()
    .single();
  if (error) throw error;
  return data as Pesquisa;
}

export async function updatePesquisa(
  id: number,
  pesquisa: Partial<Omit<Pesquisa, "id_pesquisa">>
) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(pesquisa)
    .eq("id_pesquisa", id)
    .select()
    .single();
  if (error) throw error;
  return data as Pesquisa;
}

export async function deletePesquisa(id: number) {
  const { error } = await supabase.from(TABLE).delete().eq("id_pesquisa", id);
  if (error) throw error;
}
