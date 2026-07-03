import { supabase } from "@/lib/supabaseClient";
import type { Clube } from "./types";

const TABLE = "CLUBE";

export async function getClubes() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  return data as Clube[];
}

export async function getClubeById(id: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_clube", id)
    .single();
  if (error) throw error;
  return data as Clube;
}

export async function getClubesByLiga(idLiga: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_liga", idLiga);
  if (error) throw error;
  return data as Clube[];
}

export async function createClube(clube: Omit<Clube, "id_clube">) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(clube)
    .select()
    .single();
  if (error) throw error;
  return data as Clube;
}

export async function updateClube(
  id: number,
  clube: Partial<Omit<Clube, "id_clube">>
) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(clube)
    .eq("id_clube", id)
    .select()
    .single();
  if (error) throw error;
  return data as Clube;
}

export async function deleteClube(id: number) {
  const { error } = await supabase.from(TABLE).delete().eq("id_clube", id);
  if (error) throw error;
}
