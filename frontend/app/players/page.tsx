"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Filter, Users, X, Clock, Search, Loader2 } from "lucide-react";
import { PlayerCard } from "@/components/player-card";
import { PlayerGridSkeleton } from "@/components/skeleton";
import {
  getJogadoresFiltrados,
  getClubes,
  getLigas,
  type JogadorListItem,
  type Clube,
  type Liga,
} from "@/services";
import { useAuth } from "@/lib/authContext";
import { recordHistory, listRecentHistory, type HistoryEntry } from "@/lib/history";

const POSITIONS = [
  { value: "", label: "Todas" },
  { value: "GK", label: "Goleiros (GK)" },
  { value: "DF", label: "Defensores (DF)" },
  { value: "MF", label: "Meias (MF)" },
  { value: "FW", label: "Atacantes (FW)" },
];

const LIMIT = 30;

export default function PlayersPage() {
  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [position, setPosition] = useState("");
  const [idClube, setIdClube] = useState("");
  const [idLiga, setIdLiga] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<"nome" | "idade">("nome");

  const [applied, setApplied] = useState({
    nome: "",
    position: "",
    idClube: "",
    idLiga: "",
    ordenarPor: "nome" as "nome" | "idade",
  });

  const [players, setPlayers] = useState<JogadorListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [clubes, setClubes] = useState<Clube[]>([]);
  const [ligas, setLigas] = useState<Liga[]>([]);

  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const loadRecent = useCallback(async () => {
    try {
      setRecent(await listRecentHistory(user, "filter", 5));
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
    const term = nome.trim();
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
  }, [nome]);

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
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
    applyFilters(j.nome);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
      applyFilters();
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [cs, ls] = await Promise.all([getClubes(), getLigas()]);
        setClubes(cs.sort((a, b) => a.nome.localeCompare(b.nome)));
        setLigas(ls.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch {
      }
    })();
  }, []);

  const fetchPlayers = useCallback(
    async (f: typeof applied, off: number) => {
      setLoading(true);
      setError("");
      try {
        const { jogadores, total } = await getJogadoresFiltrados({
          nome: f.nome || undefined,
          posicao: f.position || undefined,
          idClube: f.idClube ? Number(f.idClube) : undefined,
          idLiga: f.idLiga ? Number(f.idLiga) : undefined,
          ordenarPor: f.ordenarPor,
          limit: LIMIT,
          offset: off,
        });
        setPlayers(jogadores);
        setTotal(total);
      } catch {
        setError("Não foi possível carregar os jogadores. Verifique a conexão com o banco.");
        setPlayers([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPlayers(applied, offset);
  }, [fetchPlayers, applied, offset]);

  function applyFilters(overrideNome?: string) {
    const n = overrideNome ?? nome;
    if (overrideNome !== undefined) {
      justSelectedRef.current = true;
      setNome(overrideNome);
    }
    setShowSuggestions(false);
    setOffset(0);
    setApplied({ nome: n, position, idClube, idLiga, ordenarPor });
    if (n.trim()) recordHistory(user, n.trim(), "filter").then(loadRecent).catch(() => {});
  }

  function clearFilters() {
    setNome("");
    setPosition("");
    setIdClube("");
    setIdLiga("");
    setOrdenarPor("nome");
    setOffset(0);
    setApplied({ nome: "", position: "", idClube: "", idLiga: "", ordenarPor: "nome" });
  }

  const hasFilters =
    applied.nome || applied.position || applied.idClube || applied.idLiga;

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Users size={22} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Jogadores</h1>
        </div>
        <p className="text-gray-500">Explore e filtre os jogadores das grandes ligas.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div ref={boxRef} className="relative flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Buscar por nome…"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls="player-suggestions"
              aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Posição</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
            <select
              value={idClube}
              onChange={(e) => setIdClube(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 max-w-[200px]"
            >
              <option value="">Todos</option>
              {clubes.map((c) => (
                <option key={c.id_clube} value={c.id_clube}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Liga</label>
            <select
              value={idLiga}
              onChange={(e) => setIdLiga(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 max-w-[200px]"
            >
              <option value="">Todas</option>
              {ligas.map((l) => (
                <option key={l.id_liga} value={l.id_liga}>
                  {l.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ordenar por</label>
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as "nome" | "idade")}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="nome">Nome (A–Z)</option>
              <option value="idade">Idade</option>
            </select>
          </div>

          <button
            onClick={() => applyFilters()}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Filter size={15} /> Filtrar
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 text-gray-500 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <X size={15} /> Limpar
            </button>
          )}
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
                onClick={() => applyFilters(r.termo)}
                className="text-xs bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 px-3 py-1.5 rounded-full transition-colors"
              >
                {r.termo}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {/* Grid de jogadores */}
      {loading ? (
        <PlayerGridSkeleton />
      ) : players.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          Nenhum jogador encontrado com os filtros selecionados.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">{total} jogadores</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {players.map((p) => (
              <PlayerCard
                key={p.id_jogador}
                href={`/players/${p.id_jogador}`}
                name={p.nome}
                squad={p.clube}
                position={p.posicao ?? "—"}
                nationality={p.nacionalidade ?? undefined}
                photoUrl={p.foto_url}
                escudoUrl={p.escudo_url}
                bandeiraUrl={p.bandeira_url}
                stats={[
                  { label: "Gols", value: p.gols ?? "—" },
                  { label: "Assist.", value: p.assistencias ?? "—" },
                  { label: "xG", value: p.xg != null ? p.xg.toFixed(1) : "—" },
                ]}
              />
            ))}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-500">
              {offset + 1}–{Math.min(offset + LIMIT, total)} de {total}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </div>
  );
}
