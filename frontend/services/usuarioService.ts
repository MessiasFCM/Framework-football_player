import { supabase } from "@/lib/supabaseClient";
import type { Usuario } from "./types";

const TABLE = "USUARIO";

export async function getUsuarios() {
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  return data as Usuario[];
}

export async function getUsuarioById(id: number) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id_usuario", id)
    .single();
  if (error) throw error;
  return data as Usuario;
}

export async function getUsuarioByLogin(login: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("login", login)
    .maybeSingle();
  if (error) throw error;
  return (data as Usuario) ?? null;
}

export async function createUsuario(usuario: Omit<Usuario, "id_usuario">) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(usuario)
    .select()
    .single();
  if (error) throw error;
  return data as Usuario;
}

export async function updateUsuario(
  id: number,
  usuario: Partial<Omit<Usuario, "id_usuario">>
) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(usuario)
    .eq("id_usuario", id)
    .select()
    .single();
  if (error) throw error;
  return data as Usuario;
}

export async function deleteUsuario(id: number) {
  const { error } = await supabase.from(TABLE).delete().eq("id_usuario", id);
  if (error) throw error;
}
