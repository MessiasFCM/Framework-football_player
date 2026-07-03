"use client";

import { useState, useCallback } from "react";
import { Trophy, Loader2, FileDown } from "lucide-react";
import { TableSkeleton } from "@/components/skeleton";
import { getRanking, RANKING_METRICS, type RankingMetric } from "@/services/rankingService";
import { generateRankingReport } from "@/lib/rankingReport";

type Player = Record<string, string | number | null>;

const METRICS = RANKING_METRICS;

const POSITIONS = [
  { value: "",   label: "Todas" },
  { value: "GK", label: "Goleiro" },
  { value: "DF", label: "Defensor" },
  { value: "MF", label: "Meia" },
  { value: "FW", label: "Atacante" },
];

export default function RankingReportPage() {
  const [metric, setMetric] = useState("Gls");
  const [position, setPosition] = useState("");
  const [topK, setTopK] = useState(20);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Player[]>([]);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState("");

  const [applied, setApplied] = useState({ metric: "Gls", position: "" });

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ranking = await getRanking(metric as RankingMetric, topK, position || undefined);
      setResults(ranking);
      setApplied({ metric, position });
      setGenerated(true);
    } catch {
      setError("Erro ao gerar relatório. Não foi possível carregar as estatísticas.");
    } finally {
      setLoading(false);
    }
  }, [metric, position, topK]);

  const appliedMetricLabel = METRICS.find((m) => m.value === applied.metric)?.label ?? applied.metric;
  const appliedPositionLabel = POSITIONS.find((p) => p.value === applied.position)?.label;

  function handleDownloadReport() {
    if (results.length === 0) return;
    generateRankingReport({
      results,
      metricKey: applied.metric,
      metricLabel: appliedMetricLabel,
      positionLabel: applied.position ? appliedPositionLabel : undefined,
    });
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Trophy size={22} className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Relatório de Ranking</h1>
        </div>
        <p className="text-gray-500">
          Ranking dos melhores jogadores por estatística, com filtro por posição.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Métrica</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Posição</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Top N</label>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          >
            {[10, 20, 50].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Trophy size={15} />}
          Gerar Relatório
        </button>
        {!loading && generated && results.length > 0 && (
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

      {/* Table */}
      {!loading && !generated && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Trophy size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-700 font-medium mb-1">Configure e gere o ranking</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Selecione a métrica, posição e quantidade de jogadores, depois clique em "Gerar Relatório".
          </p>
        </div>
      )}
      {loading && <TableSkeleton cols={9} />}
      {!loading && generated && results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Top {results.length} · {appliedMetricLabel}
              {applied.position && ` · ${appliedPositionLabel}`}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 w-12">#</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Jogador</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Time</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Pos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Idade</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">{appliedMetricLabel}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Gols</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Assist.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Part.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{String(p.Player ?? "—")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(p.Squad ?? "—")}</td>
                    <td className="px-4 py-3 text-gray-500">{String(p.Pos ?? "—")}</td>
                    <td className="px-4 py-3 text-gray-500">{p.Age ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-brand-700">
                      {p[applied.metric] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.Gls ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.Ast ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.MP ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
