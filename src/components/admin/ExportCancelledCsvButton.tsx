"use client";

import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import { formatNumber } from "@/lib/format";

interface AuditRow {
  entity_id: string;
  action: string;
  old_value: { status?: string } | null;
  new_value: { motivo?: string | null } | null;
  actor: { full_name: string } | null;
}

export default function ExportCancelledCsvButton({ campaignId }: { campaignId: string }) {
  async function handleExport() {
    const supabase = createClient();
    const { data: orders } = await supabase
      .from("orders")
      .select(
        "id, total_cents, updated_at, customer:customers(name, whatsapp), seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(number)"
      )
      .eq("campaign_id", campaignId)
      .eq("status", "CANCELADO")
      .order("updated_at", { ascending: true });

    const rows = (orders ?? []) as unknown as {
      id: string;
      total_cents: number;
      updated_at: string;
      customer: { name: string; whatsapp: string | null } | null;
      seller: { full_name: string } | null;
      campaign_numbers: { number: number }[];
    }[];

    const orderIds = rows.map((r) => r.id);
    const { data: logs } =
      orderIds.length > 0
        ? await supabase
            .from("audit_logs")
            .select("entity_id, action, old_value, new_value, actor:profiles(full_name)")
            .eq("entity_type", "order")
            .in("entity_id", orderIds)
            .in("action", ["LIBERAR_NUMEROS", "RESERVA_EXPIRADA"])
        : { data: [] };

    const logByOrder = new Map<string, AuditRow>();
    for (const log of (logs ?? []) as unknown as AuditRow[]) {
      logByOrder.set(log.entity_id, log);
    }

    const header = [
      "Números",
      "Comprador",
      "WhatsApp",
      "Cooperador",
      "Total (R$)",
      "Era venda paga",
      "Cancelado por",
      "Motivo",
      "Data do cancelamento",
    ];
    const lines = rows.map((r) => {
      const log = logByOrder.get(r.id);
      const wasPaid = log?.old_value?.status === "PAGO";
      const canceledBy = log?.action === "RESERVA_EXPIRADA" ? "Expirou automaticamente" : (log?.actor?.full_name ?? "");
      return [
        r.campaign_numbers.map((n) => formatNumber(n.number)).join(" "),
        r.customer?.name ?? "",
        r.customer?.whatsapp ?? "",
        r.seller?.full_name ?? "",
        (r.total_cents / 100).toFixed(2),
        wasPaid ? "Sim" : "Não",
        canceledBy,
        log?.new_value?.motivo ?? "",
        new Date(r.updated_at).toLocaleString("pt-BR"),
      ];
    });

    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "semeando-juntos-cancelamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ActionButton label="Exportar CSV" labelDoing="Gerando..." labelDone="Exportado ✓" onAction={handleExport} />
  );
}
