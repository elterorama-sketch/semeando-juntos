"use client";

import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import { formatNumber } from "@/lib/format";

export default function ExportCsvButton({ campaignId }: { campaignId: string }) {
  async function handleExport() {
    const supabase = createClient();
    const { data: orders } = await supabase
      .from("orders")
      .select(
        "status, total_cents, created_at, customer:customers(name, whatsapp), seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(number)"
      )
      .eq("campaign_id", campaignId)
      .neq("status", "CANCELADO")
      .order("created_at", { ascending: true });

    const rows = (orders ?? []) as unknown as {
      status: string;
      total_cents: number;
      created_at: string;
      customer: { name: string; whatsapp: string | null } | null;
      seller: { full_name: string } | null;
      campaign_numbers: { number: number }[];
    }[];

    const header = ["Números", "Comprador", "WhatsApp", "Cooperador", "Status", "Total (R$)", "Data"];
    const lines = rows.map((r) => [
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
    a.download = "semeando-juntos-vendas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ActionButton label="Exportar CSV" labelDoing="Gerando..." labelDone="Exportado ✓" onAction={handleExport} />
  );
}
