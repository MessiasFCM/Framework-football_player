"use client";

import { useEffect, useRef, useState } from "react";
import { GitCompareArrows, Loader2, FileDown, Search } from "lucide-react";
import { PlayerCard } from "@/components/player-card";
import { Skeleton, PlayerListSkeleton, TableSkeleton } from "@/components/skeleton";
import { getSimilaresPorNome } from "@/services/recomendacaoService";
import { getJogadoresFiltrados, type JogadorListItem } from "@/services/jogadorService";
import { generateSimilarityReport } from "@/lib/similarityReport";

type Player = Record<string, string | number | null>;

const STAT_COLS = [
  { key: "Gls",  label: "Gols" },
  { key: "Ast",  label: "Assist." },
  { key: "xG",   label: "xG" },
  { key: "xAG",  label: "xAG" },
  { key: "PrgC", label: "PrgC" },
  { key: "PrgP", label: "PrgP" },
  { key: "Min",  label: "Min" },
  { key: "MP",   label: "Part." },
];

export default function SimilarityReportPage() {
  const [playerName, setPlayerName] = useState("");
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ player: Player; similar_players: Player[] } | null>(null);
  const [error, setError] = useState("");

  const [suggestions, setSuggestions] = useState<JogadorListItem[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    const term = playerName.trim();
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    if (term.length < 2) { setSuggestions([]); setSuggestLoading(false); return; }
    let cancelled = false;
    setSuggestLoading(true);
    const t = setTimeout(async () => {
      try {
        const { jogadores } = await getJogadoresFiltrados({ nome: term, limit: 8, ordenarPor: "nome" });
        if (!cancelled) { setSuggestions(jogadores); setShowSuggestions(true); setActiveIndex(-1); }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [playerName]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggestions(false);
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
    generate(j.nome);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); return; }
      if (e.key === "Escape") { setShowSuggestions(false); return; }
      if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); selectSuggestion(suggestions[activeIndex]); return; }
    }
    if (e.key === "Enter") { setShowSuggestions(false); generate(); }
  }

  async function generate(name = playerName) {
    if (!name.trim()) return;
    setShowSuggestions(false);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await getSimilaresPorNome(name.trim(), topK));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadReport() {
    if (!result) return;
    generateSimilarityReport(result);
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <GitCompareArrows size={22} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Relatório de Similaridade</h1>
        </div>
        <p className="text-gray-500">
          Comparativo estatístico entre um jogador de referência e seus similares por KNN.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 mb-6 flex flex-wrap gap-3 items-end">
        <div ref={boxRef} className="relative flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Jogador de Referência</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Ex: Erling Haaland"
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="similarity-suggestions"
            aria-activedescendant={activeIndex >= 0 ? `sim-suggestion-${activeIndex}` : undefined}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />

          {showSuggestions && (suggestLoading || suggestions.length > 0) && (
            <ul
              id="similarity-suggestions"
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
                  id={`sim-suggestion-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(j); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                    i === activeIndex ? "bg-brand-50" : "hover:bg-gray-50"
                  }`}
                >
                  {j.foto_url ? (
                    <img src={j.foto_url} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100 shrink-0" />
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

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Top N</label>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            {[5, 10, 20].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <button
          onClick={() => generate()}
          disabled={loading || !playerName.trim()}
          className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <GitCompareArrows size={15} />}
          Gerar Relatório
        </button>

        {!loading && result && (
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 border border-brand-200 text-brand-700 bg-brand-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-100 transition-colors"
          >
            <FileDown size={15} />
            Baixar PDF
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6">
          <div>
            <Skeleton className="h-4 w-40 mb-2" />
            <PlayerListSkeleton count={1} />
          </div>
          <TableSkeleton cols={10} />
        </div>
      )}

      {!loading && !result && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <GitCompareArrows size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-700 font-medium mb-1">Pesquise um jogador de referência</p>
          <p className="text-sm text-gray-400 max-w-xs">
            O relatório mostrará um comparativo estatístico entre o jogador e seus similares.
          </p>
        </div>
      )}

      {!loading && result && (
        <div className="space-y-6">
          {/* Reference card */}
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Jogador de Referência</p>
            <PlayerCard
              name={String(result.player.Player ?? "—")}
              squad={String(result.player.Squad ?? "—")}
              position={String(result.player.Pos ?? "—")}
              nationality={result.player.Nation ? String(result.player.Nation) : undefined}
              photoUrl={result.player.photo_url ? String(result.player.photo_url) : undefined}
              stats={STAT_COLS.slice(0, 4).map((s) => ({ label: s.label, value: result.player[s.key] ?? "—" }))}
            />
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-gray-900">
                Comparativo Estatístico — Top {result.similar_players.length} Similares
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">#</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Jogador</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Time</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500">Pos</th>
                    {STAT_COLS.map((s) => (
                      <th key={s.key} className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">
                        {s.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Dist.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* Reference row */}
                  <tr className="bg-brand-50">
                    <td className="px-4 py-3 text-brand-600 font-bold">★</td>
                    <td className="px-4 py-3 font-bold text-brand-900">{String(result.player.Player ?? "—")}</td>
                    <td className="px-4 py-3 text-brand-700">{String(result.player.Squad ?? "—")}</td>
                    <td className="px-4 py-3 text-brand-700">{String(result.player.Pos ?? "—")}</td>
                    {STAT_COLS.map((s) => (
                      <td key={s.key} className="px-4 py-3 text-right font-semibold text-brand-800">
                        {result.player[s.key] ?? "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-brand-600">—</td>
                  </tr>
                  {/* Similar rows */}
                  {result.similar_players.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{String(p.Player ?? "—")}</td>
                      <td className="px-4 py-3 text-gray-600">{String(p.Squad ?? "—")}</td>
                      <td className="px-4 py-3 text-gray-500">{String(p.Pos ?? "—")}</td>
                      {STAT_COLS.map((s) => (
                        <td key={s.key} className="px-4 py-3 text-right text-gray-600">
                          {p[s.key] ?? "—"}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right text-gray-500">
                        {typeof p.distance === "number" ? p.distance.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
