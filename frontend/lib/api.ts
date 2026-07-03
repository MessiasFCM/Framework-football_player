const ML_BASE = "/api/ml";

export async function getOverview() {
  const res = await fetch(`${ML_BASE}/stats/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar overview");
  return res.json();
}

export async function searchPlayers(query: string, topK = 10) {
  const res = await fetch(`${ML_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Falha na busca");
  return res.json();
}

export async function recommendPlayers(playerName: string, topK = 10) {
  const res = await fetch(`${ML_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_name: playerName, top_k: topK }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Jogador não encontrado");
  return res.json();
}

export async function listPlayers(params?: {
  position?: string;
  squad?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.position) qs.set("position", params.position);
  if (params?.squad) qs.set("squad", params.squad);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));

  const res = await fetch(`${ML_BASE}/players?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao listar jogadores");
  return res.json();
}

export async function getRankingReport(metric = "Gls", position?: string, topK = 20) {
  const qs = new URLSearchParams({ metric, top_k: String(topK) });
  if (position) qs.set("position", position);
  const res = await fetch(`${ML_BASE}/reports/ranking?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao gerar relatório");
  return res.json();
}

export async function getSimilarityReport(playerName: string, topK = 10) {
  const qs = new URLSearchParams({ player_name: playerName, top_k: String(topK) });
  const res = await fetch(`${ML_BASE}/reports/similarity?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Jogador não encontrado");
  return res.json();
}
