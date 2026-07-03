"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Network, Loader2, Info, Search, Clock, FileDown } from "lucide-react";

import { PlayerCard } from "@/components/player-card";
import { Skeleton, PlayerListSkeleton, PlayerGridSkeleton } from "@/components/skeleton";
import { useAuth } from "@/lib/authContext";
import { recordHistory, listRecentHistory, type HistoryEntry } from "@/lib/history";
import { getJogadoresFiltrados, getIdMapByNomes, type JogadorListItem } from "@/services/jogadorService";
import { getSimilaresPorNome } from "@/services/recomendacaoService";
import { generateSimilarityReport } from "@/lib/similarityReport";

type Player = Record<string, string | number | null>;

export default function RecommendPage() {
  const { user } = useAuth();
  const [playerName, setPlayerName] = useState("");
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ player: Player; similar_players: Player[] } | null>(null);
  const [idMap, setIdMap] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  function handleDownloadReport() {
    if (!result) return;
    generateSimilarityReport(result);
  }

  const loadRecent = useCallback(async () => {
    try {
      setRecent(await listRecentHistory(user, "recommend", 5));
    } catch {
      setRecent([]);
    }
  }, [user]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const [suggestions, setSuggestions] = useState<JogadorListItem[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    const term = playerName.trim();
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (term.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    const t = setTimeout(async () => {
      try {
        const { jogadores } = await getJogadoresFiltrados({
          nome: term,
          limit: 8,
          ordenarPor: "nome",
        });
        if (!cancelled) {
          setSuggestions(jogadores);
          setShowSuggestions(true);
          setActiveIndex(-1);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [playerName]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectSuggestion(j: JogadorListItem) {
    justSelectedRef.current = true;
    setPlayerName(j.nome);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
    handleRecommend(j.nome);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
        return;
      }
    }
    if (e.key === "Enter") {
      setShowSuggestions(false);
      handleRecommend();
    }
  }

  async function handleRecommend(name = playerName) {
    if (!name.trim()) return;
    setShowSuggestions(false);
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await getSimilaresPorNome(name.trim(), topK);
      setResult(data);
      const allNames = [
        data.player ? String(data.player.Player ?? "") : "",
        ...data.similar_players.map((p) => String(p.Player ?? "")),
      ].filter(Boolean);
      getIdMapByNomes(allNames).then(setIdMap).catch(() => {});
      recordHistory(user, name.trim(), "recommend").then(loadRecent).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Network size={22} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Recomendar Jogadores Similares</h1>
        </div>
        <p className="text-gray-500">
          Digite o nome de um jogador e o sistema encontra os mais similares estatisticamente usando KNN.
        </p>
      </div>

      {/* Input */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 mb-6">
        <div className="flex flex-wrap gap-3">
          <div ref={boxRef} className="relative flex-1">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Nome do jogador (ex: Erling Haaland)"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls="player-suggestions"
              aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />

            {showSuggestions && (suggestLoading || suggestions.length > 0) && (
              <ul
                id="player-suggestions"
                role="listbox"
                className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto"
              >
                {suggestLoading && suggestions.length === 0 && (
                  <li className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> Buscando…
                  </li>
                )}
                {suggestions.map((j, i) => (
                  <li
                    key={j.id_jogador}
                    id={`suggestion-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(j);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                      i === activeIndex ? "bg-brand-50" : "hover:bg-gray-50"
                    }`}
                  >
                    {j.foto_url ? (
                      <img
                        src={j.foto_url}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover bg-gray-100 shrink-0"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-500 shrink-0">
                        {j.nome.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{j.nome}</span>
                      <span className="block text-xs text-gray-400 truncate">
                        {[j.clube, j.posicao].filter((s) => s && s !== "—").join(" · ") || "—"}
                      </span>
                    </span>
                    <Search size={14} className="text-gray-300 shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </div>
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
            onClick={() => handleRecommend()}
            disabled={loading || !playerName.trim()}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Network size={16} />}
            Recomendar
          </button>
          {!loading && result && (
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 border border-brand-200 text-brand-700 bg-brand-50 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-100 transition-colors"
            >
              <FileDown size={16} />
              Baixar PDF
            </button>
          )}
        </div>

        {/* Recomendações recentes */}
        {recent.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
              <Clock size={12} /> Recentes:
            </span>
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => { setPlayerName(r.termo); handleRecommend(r.termo); }}
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

      {/* Result */}
      {!loading && !result && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Network size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-700 font-medium mb-1">Digite o nome de um jogador</p>
          <p className="text-sm text-gray-400 max-w-xs">
            O sistema encontra os jogadores estatisticamente mais similares usando KNN.
          </p>
        </div>
      )}
      {loading && (
        <div>
          <Skeleton className="h-4 w-40 mb-2" />
          <PlayerListSkeleton count={1} />
          <Skeleton className="h-4 w-48 mt-6 mb-2" />
          <PlayerGridSkeleton count={topK > 9 ? 9 : topK} />
        </div>
      )}
      {!loading && result && (
        <div>
          {/* Reference player */}
          {result.player && Object.keys(result.player).length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Jogador de Referência</p>
              <PlayerCard
                href={idMap.get(String(result.player.Player ?? "")) ? `/players/${idMap.get(String(result.player.Player ?? ""))}` : undefined}
                name={String(result.player.Player ?? "—")}
                squad={String(result.player.Squad ?? "—")}
                position={String(result.player.Pos ?? "—")}
                nationality={result.player.Nation ? String(result.player.Nation) : undefined}
                photoUrl={result.player.photo_url ? String(result.player.photo_url) : undefined}
                stats={[
                  { label: "Gols", value: result.player.Gls ?? "—" },
                  { label: "Assist.", value: result.player.Ast ?? "—" },
                  { label: "xG", value: result.player.xG ?? "—" },
                  { label: "Min", value: result.player.Min ?? "—" },
                ]}
              />
            </div>
          )}

          {/* Similar players */}
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Jogadores Similares ({result.similar_players.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {result.similar_players.map((p, i) => (
              <PlayerCard
                key={i}
                href={idMap.get(String(p.Player ?? "")) ? `/players/${idMap.get(String(p.Player ?? ""))}` : undefined}
                name={String(p.Player ?? "—")}
                squad={String(p.Squad ?? "—")}
                position={String(p.Pos ?? "—")}
                nationality={p.Nation ? String(p.Nation) : undefined}
                photoUrl={p.photo_url ? String(p.photo_url) : undefined}
                rank={i + 1}
                score={typeof p.distance === "number" ? p.distance : undefined}
                stats={[
                  { label: "Gols", value: p.Gls ?? "—" },
                  { label: "Assist.", value: p.Ast ?? "—" },
                  { label: "xG", value: p.xG ?? "—" },
                  { label: "Min", value: p.Min ?? "—" },
                ]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
