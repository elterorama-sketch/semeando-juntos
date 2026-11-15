"use client";

import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import { formatNumber } from "@/lib/format";

export default function ExportPendingCsvButton() {
  async function handleExport() {
    const supabase = createClient();
    const { data: orders } = await supabase
      .from("orders")
      .select(
        "status, total_cents, created_at, campaign:campaigns(name), customer:customers(name, whatsapp), seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(number)"
      )
      .in("status", ["RESERVADO", "AGUARDANDO_PAGAMENTO"])
      .order("created_at", { ascending: true });

    const rows = (orders ?? []) as unknown as {
      status: string;
      total_cents: number;
      created_at: string;
      campaign: { name: string } | null;
      customer: { name: string; whatsapp: string | null } | null;
      seller: { full_name: string } | null;
      campaign_numbers: { number: number }[];
    }[];

    const header = [
      "Campanha",
      "Números",
      "Comprador",
      "WhatsApp",
      "Cooperador",
      "Status",
      "Total (R$)",
      "Reservado em",
    ];
    const lines = rows.map((r) => [
      r.campaign?.name ?? "",
      r.campaign_numbers.map((n) => formatNumber(n.number)).join(" "),
      r.customer?.name ?? "",
      r.customer?.whatsapp ?? "",
      r.seller?.full_name ?? "",
      r.status,
      (r.total_cents / 100).toFixed(2),
      new Date(r.created_at).toLocaleString("pt-BR"),
    ]);

    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "semeando-juntos-reservas-pendentes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ActionButton label="Exportar CSV" labelDoing="Gerando..." labelDone="Exportado ✓" onAction={handleExport} />
  );
}
