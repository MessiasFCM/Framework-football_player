import { supabase } from "@/lib/supabaseClient";
import type { Nacionalidade } from "./types";

const TABLE = "NACIONALIDADE";

export async function getNacionalidades() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  return data as Nacionalidade[];
}

export async function getBandeirasPorCodigo(
  codigos: string[]
): Promise<Record<string, string>> {
  const unicos = [...new Set(codigos.filter(Boolean))];
  if (unicos.length === 0) return {};
  const { data, error } = await supabase
    .from(TABLE)
    .select("codigo,bandeira_url")
    .in("codigo", unicos);
  if (error) throw error;
  const mapa: Record<string, string> = {};
  for (const n of (data ?? []) as Nacionalidade[]) {
    if (n.bandeira_url) mapa[n.codigo] = n.bandeira_url;
  }
  return mapa;
}
