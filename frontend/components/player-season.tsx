"use client";

import {
  Target,
  Handshake,
  Flame,
  Clock,
  Activity,
  Footprints,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import type { Estatistica } from "@/services";

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function fmt(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function per90(value: number, minutos: number): number {
  return minutos > 0 ? (value / minutos) * 90 : 0;
}

export function PlayerSeason({ est }: { est: Estatistica }) {
  const minutos = num(est.minutos);
  const partidas = num(est.partidas);
  const gols = num(est.gols);
  const assist = num(est.assistencias);
  const xg = num(est.xg);
  const npxg = num(est.npxg);
  const xag = num(est.xag);

  const ga = gols + assist;
  const minPorJogo = partidas > 0 ? minutos / partidas : 0;
  const pctTitular = partidas > 0 ? (num(est.titular) / partidas) * 100 : 0;
  const convPenaltis =
    num(est.penaltis_tentados) > 0
      ? (num(est.penaltis) / num(est.penaltis_tentados)) * 100
      : null;

  const expData = [
    { nome: "Gols", esperado: Number(xg.toFixed(2)), real: gols },
    { nome: "Assist.", esperado: Number(xag.toFixed(2)), real: assist },
  ];

  const progData = [
    { nome: "Conduções", valor: num(est.conducoes_prog) },
    { nome: "Passes", valor: num(est.passes_prog) },
    { nome: "Recepções", valor: num(est.recepcoes_prog) },
  ];

  const destaques = [
    { icon: Target, label: "Gols", value: fmt(gols), accent: "text-red-600 bg-red-50" },
    { icon: Handshake, label: "Assistências", value: fmt(assist), accent: "text-purple-600 bg-purple-50" },
    { icon: Flame, label: "Gols + Assist.", value: fmt(ga), accent: "text-orange-600 bg-orange-50" },
    { icon: Activity, label: "Partidas", value: fmt(partidas), accent: "text-blue-600 bg-blue-50" },
    { icon: Clock, label: "Minutos", value: fmt(minutos), accent: "text-emerald-600 bg-emerald-50" },
    { icon: Footprints, label: "Min/jogo", value: fmt(minPorJogo), accent: "text-teal-600 bg-teal-50" },
  ];

  const derivados = [
    { label: "Gols por 90 min", value: fmt(per90(gols, minutos), 2) },
    { label: "Assist. por 90 min", value: fmt(per90(assist, minutos), 2) },
    { label: "Gols+Assist. por 90 min", value: fmt(per90(ga, minutos), 2) },
    { label: "Gols esperados por 90 min", value: fmt(per90(xg, minutos), 2) },
    { label: "Jogos como titular", value: `${fmt(pctTitular)}%` },
    {
      label: "Aproveitamento de pênaltis",
      value: convPenaltis != null ? `${fmt(convPenaltis)}%` : "—",
    },
  ];

  const detalhes: { label: string; hint?: string; value: string }[] = [
    { label: "Jogos como titular", value: fmt(num(est.titular)) },
    { label: "Gols (sem pênaltis)", value: fmt(num(est.gols_sem_penalti)) },
    { label: "Pênaltis convertidos", value: fmt(num(est.penaltis)) },
    { label: "Pênaltis cobrados", value: fmt(num(est.penaltis_tentados)) },
    {
      label: "Gols esperados",
      hint: "xG — quantos gols um jogador médio faria com as mesmas finalizações",
      value: fmt(xg, 2),
    },
    {
      label: "Gols esperados (sem pênaltis)",
      hint: "npxG — gols esperados desconsiderando pênaltis",
      value: fmt(npxg, 2),
    },
    {
      label: "Assistências esperadas",
      hint: "xAG — assistências esperadas pela qualidade dos passes para finalização",
      value: fmt(xag, 2),
    },
    { label: "Conduções para frente", value: fmt(num(est.conducoes_prog)) },
    { label: "Passes para frente", value: fmt(num(est.passes_prog)) },
    { label: "Recepções avançadas", value: fmt(num(est.recepcoes_prog)) },
    { label: "Cartões amarelos", value: fmt(num(est.cartoes_amarelos)) },
    { label: "Cartões vermelhos", value: fmt(num(est.cartoes_vermelhos)) },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          Temporada {est.temporada}
        </h3>
        <span className="text-xs text-gray-400">
          {fmt(partidas)} jogos · {fmt(pctTitular)}% titular
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {destaques.map((d) => {
          const Icon = d.icon;
          return (
            <div key={d.label} className="rounded-lg border border-gray-100 p-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${d.accent}`}>
                <Icon size={16} />
              </div>
              <p className="text-xl font-bold text-gray-900 leading-tight">{d.value}</p>
              <p className="text-xs text-gray-400">{d.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-lg border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Esperado vs. Realizado</p>
          <p className="text-xs text-gray-400 mb-3">
            Gols e assistências que saíram comparados ao que era esperado (xG / xAG)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={expData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Bar dataKey="esperado" name="Esperado" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="real" name="Realizado" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#cbd5e1]" /> Esperado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-brand-600" /> Realizado</span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Ações Progressivas</p>
          <p className="text-xs text-gray-400 mb-3">
            Volume de jogadas levando a bola à frente
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={progData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="nome"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Bar dataKey="valor" name="Total" radius={[0, 4, 4, 0]}>
                {progData.map((_, i) => (
                  <Cell key={i} fill={["#16a34a", "#3b82f6", "#a855f7"][i]} />
                ))}
                <LabelList dataKey="valor" position="right" style={{ fontSize: 11, fill: "#475569" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {derivados.map((d) => (
          <div key={d.label} className="rounded-lg bg-gray-50 p-3">
            <p className="text-base font-bold text-gray-900">{d.value}</p>
            <p className="text-xs text-gray-400 leading-tight">{d.label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Estatísticas detalhadas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 border-t border-gray-100 pt-3">
          {detalhes.map((d) => (
            <div key={d.label} className="flex justify-between text-sm py-1 border-b border-gray-50">
              <span
                className={
                  d.hint
                    ? "text-gray-500 underline decoration-dotted decoration-gray-300 underline-offset-2 cursor-help"
                    : "text-gray-500"
                }
                title={d.hint}
              >
                {d.label}
              </span>
              <span className="font-medium text-gray-800">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
