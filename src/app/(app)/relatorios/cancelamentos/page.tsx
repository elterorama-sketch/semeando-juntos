import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import { formatCentsBRL, formatDateTime, formatNumber } from "@/lib/format";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";
import ExportCancelledCsvButton from "@/components/admin/ExportCancelledCsvButton";

export const dynamic = "force-dynamic";

interface CancelledOrderRow {
  id: string;
  total_cents: number;
  created_at: string;
  updated_at: string;
  customer: { name: string; whatsapp: string | null } | null;
  seller: { full_name: string } | null;
  campaign_numbers: { number: number }[];
}

interface AuditRow {
  entity_id: string;
  action: string;
  created_at: string;
  old_value: { status?: string } | null;
  new_value: { motivo?: string | null } | null;
  actor: { full_name: string } | null;
}

export default async function CancelamentosPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return (
      <>
        <TopBar title="Cancelamentos" />
        <NoPermission />
      </>
    );
  }

  const campaign = await getActiveCampaign();
  if (!campaign) {
    return (
      <>
        <TopBar title="Cancelamentos" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa.</div>
      </>
    );
  }

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, total_cents, created_at, updated_at, customer:customers(name, whatsapp), seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(number)"
    )
    .eq("campaign_id", campaign.id)
    .eq("status", "CANCELADO")
    .order("updated_at", { ascending: false });

  const cancelled = (orders ?? []) as unknown as CancelledOrderRow[];
  const orderIds = cancelled.map((o) => o.id);

  const { data: logs } =
    orderIds.length > 0
      ? await supabase
          .from("audit_logs")
          .select("entity_id, action, created_at, old_value, new_value, actor:profiles(full_name)")
          .eq("entity_type", "order")
          .in("entity_id", orderIds)
          .in("action", ["LIBERAR_NUMEROS", "RESERVA_EXPIRADA"])
          .order("created_at", { ascending: false })
      : { data: [] };

  // Um pedido pode, em teoria, aparecer mais de uma vez no histórico (não
  // deveria -- uma vez CANCELADO ele não reserva de novo sob o mesmo id --
  // mas por segurança pega sempre o evento mais recente por pedido).
  const latestLogByOrder = new Map<string, AuditRow>();
  for (const log of (logs ?? []) as unknown as AuditRow[]) {
    if (!latestLogByOrder.has(log.entity_id)) {
      latestLogByOrder.set(log.entity_id, log);
    }
  }

  const rows = cancelled.map((order) => {
    const log = latestLogByOrder.get(order.id);
    const wasPaid = log?.old_value?.status === "PAGO";
    const reason = log?.new_value?.motivo ?? null;
    const canceledBy = log?.action === "RESERVA_EXPIRADA" ? "Expirou automaticamente" : (log?.actor?.full_name ?? "—");
    return { order, wasPaid, reason, canceledBy };
  });

  const totalWasPaid = rows.filter((r) => r.wasPaid).length;

  return (
    <>
      <TopBar title="Cancelamentos" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
            <p className="text-xs font-medium uppercase tracking-wide text-verde-oliva">
              Total de cancelamentos
            </p>
            <p className="mt-1 text-xl font-bold text-verde-profundo">{rows.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-terracota/20">
            <p className="text-xs font-medium uppercase tracking-wide text-terracota">
              Eram vendas pagas
            </p>
            <p className="mt-1 text-xl font-bold text-terracota">{totalWasPaid}</p>
          </div>
        </div>

        <ExportCancelledCsvButton campaignId={campaign.id} />

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="py-10 text-center text-sm text-verde-oliva">
              Nenhum cancelamento registrado nesta campanha.
            </p>
          )}
          {rows.map(({ order, wasPaid, reason, canceledBy }) => (
            <div
              key={order.id}
              className={`rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ${
                wasPaid ? "ring-terracota/30" : "ring-verde-oliva/10"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-verde-profundo">
                    {order.campaign_numbers.map((n) => formatNumber(n.number)).join(" • ")}
                  </p>
                  <p className="truncate text-verde-oliva">{order.customer?.name ?? "—"}</p>
                  {order.seller && (
                    <p className="truncate text-xs text-verde-profundo/75">
                      Cooperador: {order.seller.full_name}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-verde-profundo">{formatCentsBRL(order.total_cents)}</p>
                  {wasPaid && (
                    <span className="inline-block rounded-full bg-terracota/15 px-2 py-0.5 text-xs font-semibold text-terracota">
                      Era venda paga
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-verde-oliva">
                Cancelado por <span className="font-medium">{canceledBy}</span> em{" "}
                {formatDateTime(order.updated_at)}
              </p>
              {reason && <p className="mt-1 text-xs italic text-verde-profundo/75">Motivo: {reason}</p>}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
