import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Player = Record<string, string | number | null>;

interface RankingReportInput {
  results: Player[];
  metricKey: string;
  metricLabel: string;
  positionLabel?: string;
}

const BRAND: [number, number, number] = [22, 163, 74]; 
const BRAND_LIGHT: [number, number, number] = [240, 253, 244];
const GRAY: [number, number, number] = [107, 114, 128];

const SUPPORT_COLS: { key: string; label: string }[] = [
  { key: "Gls", label: "Gols" },
  { key: "Ast", label: "Assist." },
  { key: "xG", label: "xG" },
  { key: "Min", label: "Min" },
  { key: "MP", label: "Part." },
];


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

function fileName(metricLabel: string, positionLabel?: string): string {
  const parts = [metricLabel, positionLabel].filter(Boolean).join("-");
  const slug = clean(parts).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `relatorio-ranking-${slug || "geral"}.pdf`;
}

export function generateRankingReport({
  results,
  metricKey,
  metricLabel,
  positionLabel,
}: RankingReportInput): void {
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
  doc.text("Relatorio de Ranking de Jogadores", margin, 52);

  const now = new Date();
  const dateStr =
    now.toLocaleDateString("pt-BR") +
    " " +
    now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  doc.setFontSize(9);
  doc.text(`Gerado em ${dateStr}`, pageW - margin, 52, { align: "right" });

  let y = 100;
  doc.setTextColor(...BRAND);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Top ${results.length} - ${clean(metricLabel)}`, margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const criterios = [
    `Metrica: ${clean(metricLabel)}`,
    `Posicao: ${positionLabel ? clean(positionLabel) : "Todas"}`,
    `Total: ${results.length} jogadores`,
  ].join("    |    ");
  doc.text(criterios, margin, y + 18);

  const supportCols = SUPPORT_COLS.filter((c) => c.key !== metricKey);
  const head = [
    ["#", "Jogador", "Time", "Pos", "Nac.", "Idade", clean(metricLabel), ...supportCols.map((c) => c.label)],
  ];

  const body = results.map((p, i) => [
    String(i + 1),
    clean(p.Player),
    clean(p.Squad),
    clean(p.Pos),
    p.Nation ? clean(p.Nation) : "—",
    p.Age ?? "—",
    statValue(p, metricKey),
    ...supportCols.map((c) => statValue(p, c.key)),
  ]);

  const metricColIdx = 6;

  autoTable(doc, {
    head,
    body,
    startY: y + 34,
    margin: { left: margin, right: margin },
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 26 },
      1: { fontStyle: "bold" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0 && data.row.index < 3) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = BRAND;
      }
      if (data.column.index === metricColIdx) {
        data.cell.styles.halign = "right";
        data.cell.styles.fontStyle = "bold";
        if (data.section === "body") {
          data.cell.styles.fillColor = BRAND_LIGHT;
          data.cell.styles.textColor = BRAND;
        }
      } else if (data.column.index > metricColIdx) {
        data.cell.styles.halign = "right";
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    `Ranking ordenado por ${clean(metricLabel)} (maior para menor), calculado a partir das estatisticas da temporada.`,
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

  doc.save(fileName(metricLabel, positionLabel));
}
