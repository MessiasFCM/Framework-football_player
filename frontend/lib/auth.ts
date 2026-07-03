import { createUsuario, getUsuarioByLogin } from "@/services/usuarioService";

export interface AuthUser {
  id_usuario: number;
  email: string;
  nome: string | null;
}

const STORAGE_KEY = "futanalytics_user";

async function hashSenha(senha: string): Promise<string> {
  const data = new TextEncoder().encode(senha);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signUp(
  nome: string,
  email: string,
  senha: string
): Promise<AuthUser> {
  const existing = await getUsuarioByLogin(email.toLowerCase());
  if (existing) throw new Error("Esse e-mail já está cadastrado.");

  const senhaHash = await hashSenha(senha);
  const usuario = await createUsuario({
    login: email.toLowerCase(),
    senha: senhaHash,
    nome: nome.trim() || null,
  });
  const user: AuthUser = {
    id_usuario: usuario.id_usuario,
    email: usuario.login,
    nome: usuario.nome,
  };
  persistUser(user);
  return user;
}

export async function signIn(email: string, senha: string): Promise<AuthUser> {
  const usuario = await getUsuarioByLogin(email.toLowerCase());
  const senhaHash = await hashSenha(senha);
  if (!usuario || usuario.senha !== senhaHash) {
    throw new Error("E-mail ou senha incorretos.");
  }
  const user: AuthUser = {
    id_usuario: usuario.id_usuario,
    email: usuario.login,
    nome: usuario.nome,
  };
  persistUser(user);
  return user;
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function persistUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}
