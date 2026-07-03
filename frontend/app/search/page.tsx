"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Loader2, Info, Clock } from "lucide-react";
import { PlayerCard } from "@/components/player-card";
import { PlayerListSkeleton } from "@/components/skeleton";
import { useAuth } from "@/lib/authContext";
import { recordHistory, listRecentHistory, type HistoryEntry } from "@/lib/history";
import { getIdMapByNomes } from "@/services/jogadorService";

type Player = Record<string, string | number | null>;

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(10);
  const [engine, setEngine] = useState<"bm25" | "biencoder">("bm25");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Player[]>([]);
  const [idMap, setIdMap] = useState<Map<string, number>>(new Map());
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  const loadRecent = useCallback(async () => {
    try {
      setRecent(await listRecentHistory(user, "search", 5));
    } catch {
      setRecent([]);
    }
  }, [user]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  async function handleSearch(q = query) {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setSearched(false);

    try {
      const res = await fetch("/api/ml/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), top_k: topK, engine }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const players: Player[] = data.results ?? [];
      setResults(players);
      const names = players.map((p) => String(p.Player ?? "")).filter(Boolean);
      getIdMapByNomes(names).then(setIdMap).catch(() => {});
      recordHistory(user, q.trim(), "search").then(loadRecent).catch(() => {});
    } catch {
      setError("Não foi possível conectar ao serviço ML. Certifique-se de que o ml-service está rodando.");
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Search size={22} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Busca por Perfil</h1>
        </div>
        <p className="text-gray-500">
          Descreva em linguagem natural o tipo de jogador que procura. Escolha o método ao lado: BM25 (textual) ou bi-encoder (semântico).
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Ex: atacante veloz com alto xG e progressão..."
            className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as "bm25" | "biencoder")}
            title="Método de busca"
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="bm25">BM25 (textual)</option>
            <option value="biencoder">Bi-encoder (semântico)</option>
          </select>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            {[5, 10, 20].map((k) => (
              <option key={k} value={k}>Top {k}</option>
            ))}
          </select>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Buscar
          </button>
        </div>

        {/* Buscas recentes */}
        {recent.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
              <Clock size={12} /> Recentes:
            </span>
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => { setQuery(r.termo); handleSearch(r.termo); }}
                className="text-xs bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 px-3 py-1.5 rounded-full transition-colors"
              >
                {r.termo}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">
          <Info size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && !searched && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Search size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-700 font-medium mb-1">Descreva o jogador que procura</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Use linguagem natural, como "atacante veloz com alto xG" ou "goleiro com muitas defesas".
          </p>
        </div>
      )}
      {loading && <PlayerListSkeleton count={topK > 5 ? 5 : topK} />}
      {!loading && searched && !error && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {results.length} resultado{results.length !== 1 ? "s" : ""} para{" "}
            <span className="font-medium text-gray-800">"{query}"</span>
          </p>
          {results.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum resultado encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map((p, i) => (
                <PlayerCard
                  key={i}
                  href={idMap.get(String(p.Player ?? "")) ? `/players/${idMap.get(String(p.Player ?? ""))}` : undefined}
                  name={String(p.Player ?? "—")}
                  squad={String(p.Squad ?? "—")}
                  position={String(p.Pos ?? "—")}
                  nationality={p.Nation ? String(p.Nation) : undefined}
                  photoUrl={p.photo_url ? String(p.photo_url) : undefined}
                  rank={i + 1}
                  score={typeof p.score === "number" ? p.score : undefined}
                  stats={[
                    { label: "Gols", value: p.Gls ?? "—" },
                    { label: "Assist.", value: p.Ast ?? "—" },
                    { label: "xG", value: p.xG ?? "—" },
                    { label: "Min", value: p.Min ?? "—" },
                  ]}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
