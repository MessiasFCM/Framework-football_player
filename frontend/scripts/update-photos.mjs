import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

function loadEnv(path) {
  const content = readFileSync(path, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv(new URL("../.env", import.meta.url));
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const csvPath = new URL(
  "../../backend/data/processed/players_with_photo_url.csv",
  import.meta.url
);
const csvContent = readFileSync(csvPath, "utf-8");
const rows = parse(csvContent, { columns: true, skip_empty_lines: true });

const photoByKey = new Map();
for (const row of rows) {
  if (!row.photo_url) continue;
  photoByKey.set(`${row.Player}|${row.Nation}`, row.photo_url);
}
console.log(`CSV: ${rows.length} jogadores, ${photoByKey.size} com foto.`);

const PAGE_SIZE = 1000;
const jogadores = [];
for (let offset = 0; ; offset += PAGE_SIZE) {
  const { data, error } = await supabase
    .from("JOGADOR")
    .select("id_jogador,nome,nacionalidade")
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  jogadores.push(...data);
  if (data.length < PAGE_SIZE) break;
}
console.log(`Supabase: ${jogadores.length} jogadores.`);

const updates = [];
for (const j of jogadores) {
  const url = photoByKey.get(`${j.nome}|${j.nacionalidade}`);
  if (url) updates.push({ id_jogador: j.id_jogador, foto_url: url });
}
console.log(`Correspondências encontradas: ${updates.length}`);

const CONCURRENCY = 20;
let done = 0;
let failed = 0;
for (let i = 0; i < updates.length; i += CONCURRENCY) {
  const batch = updates.slice(i, i + CONCURRENCY);
  const results = await Promise.all(
    batch.map((u) =>
      supabase.from("JOGADOR").update({ foto_url: u.foto_url }).eq("id_jogador", u.id_jogador)
    )
  );
  for (const r of results) {
    if (r.error) {
      failed++;
      console.error("Falha:", r.error.message);
    } else {
      done++;
    }
  }
  console.log(`Atualizados ${done}/${updates.length}${failed ? ` (${failed} falhas)` : ""}`);
}

console.log("Concluído.");
