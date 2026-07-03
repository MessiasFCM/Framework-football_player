import { createPesquisa, getPesquisasByUsuario, deletePesquisa } from "@/services/pesquisaService";
import type { AuthUser } from "./auth";

export type HistoryType = "search" | "filter" | "recommend";

export interface HistoryEntry {
  id: string;
  termo: string;
  tipo: HistoryType;
  data_hora: string;
}

const PREFIXES: Record<HistoryType, string> = {
  search: "@search ",
  filter: "@filter ",
  recommend: "@recommend ",
};

const LOCAL_KEY = "futanalytics_history";
const MAX_PER_TYPE = 5;

function encode(termo: string, tipo: HistoryType): string {
  return `${PREFIXES[tipo]}${termo}`;
}

function decode(raw: string): { termo: string; tipo: HistoryType } | null {
  for (const [tipo, prefix] of Object.entries(PREFIXES) as [HistoryType, string][]) {
    if (raw.startsWith(prefix)) return { termo: raw.slice(prefix.length), tipo };
  }
  return null;
}

export async function recordHistory(
  user: AuthUser | null,
  termo: string,
  tipo: HistoryType
): Promise<void> {
  const termoLower = termo.toLowerCase();

  if (user) {
    await createPesquisa({ id_usuario: user.id_usuario, termo: encode(termo, tipo) });

    const all = await getPesquisasByUsuario(user.id_usuario);

    const ofType = all
      .map((r) => ({ id_pesquisa: r.id_pesquisa, data_hora: r.data_hora, decoded: decode(r.termo) }))
      .filter((r) => r.decoded?.tipo === tipo)
      .sort((a, b) => b.data_hora.localeCompare(a.data_hora)); 

    const toDelete: number[] = [];
    const seen = new Set<string>();

    for (const r of ofType) {
      const t = r.decoded!.termo.toLowerCase();
      if (seen.has(t) || seen.size >= MAX_PER_TYPE) {
        toDelete.push(r.id_pesquisa);
      } else {
        seen.add(t);
      }
    }

    if (toDelete.length > 0) {
      await Promise.all(toDelete.map((id) => deletePesquisa(id)));
    }
    return;
  }

  const all = readLocal();
  const sem_duplicata = all.filter(
    (e) => !(e.tipo === tipo && e.termo.toLowerCase() === termoLower)
  );
  const ofTypeRecent = sem_duplicata.filter((e) => e.tipo === tipo).slice(0, MAX_PER_TYPE - 1);
  const otherTypes = sem_duplicata.filter((e) => e.tipo !== tipo);

  writeLocal([
    { id: crypto.randomUUID(), termo, tipo, data_hora: new Date().toISOString() },
    ...ofTypeRecent,
    ...otherTypes,
  ]);
}

export async function listRecentHistory(
  user: AuthUser | null,
  tipo: HistoryType,
  limit = MAX_PER_TYPE
): Promise<HistoryEntry[]> {
  if (user) {
    const rows = await getPesquisasByUsuario(user.id_usuario);
    return rows
      .map((r) => {
        const decoded = decode(r.termo);
        return decoded ? { id: String(r.id_pesquisa), data_hora: r.data_hora, ...decoded } : null;
      })
      .filter((e): e is HistoryEntry => e !== null && e.tipo === tipo)
      .sort((a, b) => b.data_hora.localeCompare(a.data_hora))
      .slice(0, limit);
  }
  return readLocal().filter((e) => e.tipo === tipo).slice(0, limit);
}

function readLocal(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: HistoryEntry[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
}
