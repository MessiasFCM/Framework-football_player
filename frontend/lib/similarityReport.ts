import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Player = Record<string, string | number | null>;

interface SimilarityResult {
  player: Player;
  similar_players: Player[];
}

const STAT_COLS: { key: string; label: string }[] = [
  { key: "Gls", label: "Gols" },
  { key: "Ast", label: "Assist." },
  { key: "xG", label: "xG" },
  { key: "xAG", label: "xAG" },
  { key: "PrgC", label: "PrgC" },
  { key: "PrgP", label: "PrgP" },
  { key: "Min", label: "Min" },
  { key: "MP", label: "Part." },
];

const BRAND: [number, number, number] = [22, 163, 74]; 
const BRAND_LIGHT: [number, number, number] = [240, 253, 244];
const GRAY: [number, number, number] = [107, 114, 128];

function clean(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function statValue(p: Player, key: string): string {
  const v = p[key];
  if (v === null || v === undefined) return "—";
  if (key === "xG" || key === "xAG") {
    return typeof v === "number" ? v.toFixed(1) : String(v);
  }
  return String(v);
}

function fileName(name: string): string {
  const slug = clean(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `relatorio-similaridade-${slug || "jogador"}.pdf`;
}

export function generateSimilarityReport(result: SimilarityResult): void {
  const { player, similar_players } = result;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("FutAnalytics", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Relatorio de Similaridade entre Jogadores", margin, 52);

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  doc.setFontSize(9);
  doc.text(`Gerado em ${dateStr}`, pageW - margin, 52, { align: "right" });

  let y = 100;
  doc.setTextColor(...BRAND);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Jogador de Referencia", margin, y);

  y += 20;
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(16);
  doc.text(clean(player.Player), margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const meta = [clean(player.Squad), clean(player.Pos), player.Nation ? clean(player.Nation) : null]
    .filter((s) => s && s !== "—")
    .join("   |   ");
  doc.text(meta, margin, y + 16);

  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  const refStats = STAT_COLS.map((s) => `${s.label}: ${statValue(player, s.key)}`).join("    ");
  doc.text(refStats, margin, y + 34);

  const head = [["#", "Jogador", "Time", "Pos", "Nac.", ...STAT_COLS.map((s) => s.label), "Distancia"]];

  const refRow = [
    "*",
    clean(player.Player),
    clean(player.Squad),
    clean(player.Pos),
    player.Nation ? clean(player.Nation) : "—",
    ...STAT_COLS.map((s) => statValue(player, s.key)),
    "—",
  ];

  const simRows = similar_players.map((p, i) => [
    String(i + 1),
    clean(p.Player),
    clean(p.Squad),
    clean(p.Pos),
    p.Nation ? clean(p.Nation) : "—",
    ...STAT_COLS.map((s) => statValue(p, s.key)),
    typeof p.distance === "number" ? p.distance.toFixed(3) : "—",
  ]);

  autoTable(doc, {
    head,
    body: [refRow, ...simRows],
    startY: y + 50,
    margin: { left: margin, right: margin },
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 24 },
      1: { fontStyle: "bold" },
      3: { halign: "center" },
      4: { halign: "center" },
    },

    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 0) {
        data.cell.styles.fillColor = BRAND_LIGHT;
        data.cell.styles.textColor = BRAND;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index >= 5 && data.column.index !== 4) {
        data.cell.styles.halign = "right";
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    "A distancia indica o quao proximo estatisticamente o jogador esta da referencia (menor = mais similar), calculada por KNN.",
    margin,
    finalY + 18
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(
      `Pagina ${i} de ${pageCount}`,
      pageW - margin,
      doc.internal.pageSize.getHeight() - 16,
      { align: "right" }
    );
  }

  doc.save(fileName(String(player.Player ?? "jogador")));
}
