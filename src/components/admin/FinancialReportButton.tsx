"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import { formatCentsBRL, formatDateTime, formatNumber } from "@/lib/format";
import type { Campaign, NumberStatus, PaymentMethod } from "@/lib/database.types";

// jspdf-autotable augments the jsPDF instance with this at runtime, but
// ships no type declarations for it.
type WithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

const BRAND = {
  verdeProfundo: "#1F3D2B",
  verdeOliva: "#5C6B3B",
  terracota: "#B5623A",
  creme: "#F3ECDD",
};

const STATUS_LABEL: Record<NumberStatus, string> = {
  DISPONIVEL: "Disponível",
  RESERVADO: "Reservado",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};

interface OrderRow {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  customer: { name: string; congregation_id: string | null } | null;
  seller: { full_name: string } | null;
  campaign_numbers: { number: number }[];
}

// Draws a simple horizontal bar chart on a fresh canvas and returns it as a
// PNG data URL -- avoids pulling in a charting library just for two bar
// charts in an admin-only PDF.
function barChartImage(
  title: string,
  data: { label: string; value: number; color: string }[],
  formatValue: (v: number) => string
): string {
  const width = 900;
  const rowHeight = 54;
  const height = 70 + data.length * rowHeight + 20;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#FBF9F3";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = BRAND.verdeProfundo;
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(title, 20, 16);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartLeft = 260;
  const chartWidth = width - chartLeft - 180;

  data.forEach((d, i) => {
    const y = 70 + i * rowHeight;
    ctx.fillStyle = BRAND.verdeProfundo;
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(d.label, chartLeft - 16, y + 14);

    const barWidth = Math.max((d.value / maxValue) * chartWidth, 2);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    const r = 8;
    ctx.moveTo(chartLeft, y);
    ctx.arcTo(chartLeft + barWidth, y, chartLeft + barWidth, y + 34, r);
    ctx.arcTo(chartLeft + barWidth, y + 34, chartLeft, y + 34, r);
    ctx.lineTo(chartLeft, y + 34);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = BRAND.verdeProfundo;
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(formatValue(d.value), chartLeft + barWidth + 14, y + 14);
  });

  return canvas.toDataURL("image/png");
}

export default function FinancialReportButton({ campaign }: { campaign: Campaign }) {
  async function handleGenerate() {
    const supabase = createClient();

    const [{ data: numbers }, { data: orders }, { data: payments }, { data: congregations }] =
      await Promise.all([
        supabase.from("campaign_numbers").select("status").eq("campaign_id", campaign.id),
        supabase
          .from("orders")
          .select(
            "id, status, total_cents, created_at, customer:customers(name, congregation_id), seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(number)"
          )
          .eq("campaign_id", campaign.id)
          .neq("status", "CANCELADO")
          .order("created_at", { ascending: true }),
        supabase
          .from("payments")
          .select("amount_cents, method, order:orders!inner(campaign_id)")
          .eq("order.campaign_id", campaign.id),
        supabase.from("congregations").select("id, name"),
      ]);

    const numberRows = (numbers ?? []) as { status: NumberStatus }[];
    const orderRows = (orders ?? []) as unknown as OrderRow[];
    const paymentRows = (payments ?? []) as unknown as { amount_cents: number; method: PaymentMethod }[];
    const congregationName = new Map((congregations ?? []).map((c) => [c.id, c.name]));

    // ---- aggregates ----
    const statusCounts: Record<NumberStatus, number> = {
      DISPONIVEL: 0,
      RESERVADO: 0,
      AGUARDANDO_PAGAMENTO: 0,
      PAGO: 0,
      CANCELADO: 0,
    };
    numberRows.forEach((n) => statusCounts[n.status]++);

    const paidOrders = orderRows.filter((o) => o.status === "PAGO");
    const pendingOrders = orderRows.filter((o) => o.status !== "PAGO");
    const totalArrecadadoCents = paidOrders.reduce((sum, o) => sum + o.total_cents, 0);
    const totalPendenteCents = pendingOrders.reduce((sum, o) => sum + o.total_cents, 0);
    const totalPrevistoCents = campaign.number_count * campaign.price_cents;
    const ticketMedioCents = paidOrders.length > 0 ? Math.round(totalArrecadadoCents / paidOrders.length) : 0;

    const byMethod = new Map<PaymentMethod, number>();
    paymentRows.forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_cents));

    const bySeller = new Map<string, number>();
    paidOrders.forEach((o) => {
      const name = o.seller?.full_name ?? "-";
      bySeller.set(name, (bySeller.get(name) ?? 0) + o.total_cents);
    });
    const sellerRanking = Array.from(bySeller.entries())
      .map(([name, cents]) => ({ name, cents }))
      .sort((a, b) => b.cents - a.cents);

    const byCongregation = new Map<string, number>();
    paidOrders.forEach((o) => {
      const congId = o.customer?.congregation_id ?? null;
      const label = congId ? (congregationName.get(congId) ?? "Sem congregação") : "Sem congregação";
      byCongregation.set(label, (byCongregation.get(label) ?? 0) + o.total_cents);
    });
    const congregationRanking = Array.from(byCongregation.entries())
      .map(([name, cents]) => ({ name, cents }))
      .sort((a, b) => b.cents - a.cents);

    // ---- charts ----
    const methodChart = barChartImage(
      "Arrecadação por forma de pagamento",
      Array.from(byMethod.entries()).map(([method, cents]) => ({
        label: METHOD_LABEL[method] ?? method,
        value: cents,
        color: BRAND.terracota,
      })),
      formatCentsBRL
    );

    const statusChart = barChartImage(
      "Números por status",
      (Object.keys(statusCounts) as NumberStatus[])
        .filter((s) => s !== "CANCELADO" || statusCounts[s] > 0)
        .map((s) => ({
          label: STATUS_LABEL[s],
          value: statusCounts[s],
          color: s === "PAGO" ? "#0F9D63" : s === "RESERVADO" ? "#F2B233" : s === "AGUARDANDO_PAGAMENTO" ? "#E07A3F" : BRAND.verdeOliva,
        })),
      (v) => String(v)
    );

    // ---- PDF ----
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = margin;

    doc.setFillColor(BRAND.verdeProfundo);
    doc.rect(0, 0, pageWidth, 90, "F");
    doc.setTextColor("#FBF9F3");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Relatório Contábil-Financeiro", margin, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(campaign.name, margin, 62);
    doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, margin, 78);

    y = 120;
    doc.setTextColor(BRAND.verdeProfundo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Resumo financeiro", margin, y);
    y += 20;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: BRAND.verdeProfundo, textColor: "#FBF9F3" },
      styles: { fontSize: 10, cellPadding: 6 },
      head: [["Indicador", "Valor"]],
      body: [
        ["Valor previsto (todos os números)", formatCentsBRL(totalPrevistoCents)],
        ["Total arrecadado (pago)", formatCentsBRL(totalArrecadadoCents)],
        ["Total pendente (reservado/aguardando)", formatCentsBRL(totalPendenteCents)],
        ["Ticket médio por pedido pago", formatCentsBRL(ticketMedioCents)],
        ["Pedidos pagos", String(paidOrders.length)],
        ["Pedidos pendentes", String(pendingOrders.length)],
        [
          "Números pagos / total",
          `${statusCounts.PAGO} / ${campaign.number_count} (${((statusCounts.PAGO / campaign.number_count) * 100).toFixed(1)}%)`,
        ],
      ],
    });
    y = (doc as WithAutoTable).lastAutoTable.finalY + 30;

    if (y > 620) {
      doc.addPage();
      y = margin;
    }
    doc.addImage(statusChart, "PNG", margin, y, pageWidth - margin * 2, ((pageWidth - margin * 2) * 0.35));
    y += (pageWidth - margin * 2) * 0.35 + 20;

    if (y > 620) {
      doc.addPage();
      y = margin;
    }
    if (byMethod.size > 0) {
      doc.addImage(methodChart, "PNG", margin, y, pageWidth - margin * 2, (pageWidth - margin * 2) * 0.3);
      y += (pageWidth - margin * 2) * 0.3 + 20;
    }

    doc.addPage();
    y = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(BRAND.verdeProfundo);
    doc.text("Arrecadação por cooperador", margin, y);
    y += 16;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "striped",
      headStyles: { fillColor: BRAND.verdeProfundo, textColor: "#FBF9F3" },
      styles: { fontSize: 10, cellPadding: 6 },
      head: [["Cooperador", "Total arrecadado"]],
      body: sellerRanking.map((s) => [s.name, formatCentsBRL(s.cents)]),
    });
    y = (doc as WithAutoTable).lastAutoTable.finalY + 30;

    if (y > 620) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Arrecadação por congregação", margin, y);
    y += 16;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "striped",
      headStyles: { fillColor: BRAND.verdeProfundo, textColor: "#FBF9F3" },
      styles: { fontSize: 10, cellPadding: 6 },
      head: [["Congregação", "Total arrecadado"]],
      body: congregationRanking.map((c) => [c.name, formatCentsBRL(c.cents)]),
    });

    doc.addPage();
    y = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(BRAND.verdeProfundo);
    doc.text("Extrato completo de pedidos", margin, y);
    y += 16;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: BRAND.verdeProfundo, textColor: "#FBF9F3" },
      styles: { fontSize: 8, cellPadding: 4 },
      head: [["Números", "Comprador", "Cooperador", "Status", "Valor", "Data"]],
      body: orderRows.map((o) => [
        o.campaign_numbers.map((n) => formatNumber(n.number)).join(" "),
        o.customer?.name ?? "-",
        o.seller?.full_name ?? "-",
        o.status,
        formatCentsBRL(o.total_cents),
        formatDateTime(o.created_at),
      ]),
    });

    doc.save(`relatorio-financeiro-${campaign.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  }

  return (
    <ActionButton
      label="Gerar relatório PDF"
      labelDoing="Gerando..."
      labelDone="Gerado ✓"
      onAction={handleGenerate}
    />
  );
}
