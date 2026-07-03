import { supabase } from "@/lib/supabaseClient";
import type { Liga } from "./types";

const TABLE = "LIGA";

export async function getLigas() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  return data as Liga[];
}

export async function getLigaById(id: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_liga", id)
    .single();
  if (error) throw error;
  return data as Liga;
}

export async function createLiga(liga: Omit<Liga, "id_liga">) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(liga)
    .select()
    .single();
  if (error) throw error;
  return data as Liga;
}

export async function updateLiga(
  id: number,
  liga: Partial<Omit<Liga, "id_liga">>
) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(liga)
    .eq("id_liga", id)
    .select()
    .single();
  if (error) throw error;
  return data as Liga;
}

export async function deleteLiga(id: number) {
  const { error } = await supabase.from(TABLE).delete().eq("id_liga", id);
  if (error) throw error;
}
