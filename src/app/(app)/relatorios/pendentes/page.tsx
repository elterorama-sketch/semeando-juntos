import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import { formatCentsBRL, formatDateTime } from "@/lib/format";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";
import { StatusBadge } from "@/components/StatusBadge";
import ExportPendingCsvButton from "@/components/admin/ExportPendingCsvButton";
import type { NumberStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

interface PendingOrderRow {
  id: string;
  status: NumberStatus | string;
  total_cents: number;
  created_at: string;
  campaign: { name: string } | null;
  customer: { name: string; whatsapp: string | null } | null;
  seller: { full_name: string } | null;
  campaign_numbers: { number: number }[];
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// "Relatório de números reservados e não pagos de todo o período" --
// diferente de Tesouraria (que só mostra "Aguardando confirmação" da
// campanha ATIVA), este cruza TODAS as campanhas, passadas e presente, sem
// filtro de data: é a visão de "o que nunca foi resolvido", útil pra achar
// reservas antigas esquecidas de campanhas encerradas.
export default async function PendentesPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return (
      <>
        <TopBar title="Reservas pendentes" />
        <NoPermission />
      </>
    );
  }

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, total_cents, created_at, campaign:campaigns(name), customer:customers(name, whatsapp), seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(number)"
    )
    .in("status", ["RESERVADO", "AGUARDANDO_PAGAMENTO"])
    .order("created_at", { ascending: true });

  const rows = (orders ?? []) as unknown as PendingOrderRow[];
  const totalCents = rows.reduce((acc, o) => acc + o.total_cents, 0);
  const numbersCount = rows.reduce((acc, o) => acc + o.campaign_numbers.length, 0);
  const oldestDays = rows.length > 0 ? daysSince(rows[0].created_at) : 0;

  return (
    <>
      <TopBar title="Reservas pendentes" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <p className="text-sm text-verde-oliva">
          Números reservados ou aguardando pagamento em qualquer campanha, de qualquer data -- não só a
          campanha ativa de hoje.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
            <p className="text-xs font-medium uppercase tracking-wide text-verde-oliva">Pedidos</p>
            <p className="mt-1 text-xl font-bold text-verde-profundo">{rows.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
            <p className="text-xs font-medium uppercase tracking-wide text-verde-oliva">Números</p>
            <p className="mt-1 text-xl font-bold text-verde-profundo">{numbersCount}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-terracota/20">
            <p className="text-xs font-medium uppercase tracking-wide text-terracota">Mais antiga</p>
            <p className="mt-1 text-xl font-bold text-terracota">{oldestDays}d</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-verde-oliva/10">
          <span className="text-sm text-verde-oliva">Valor total pendente</span>
          <span className="font-bold text-verde-profundo">{formatCentsBRL(totalCents)}</span>
        </div>

        <ExportPendingCsvButton />

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="py-10 text-center text-sm text-verde-oliva">
              Nenhuma reserva pendente em nenhuma campanha. 🎉
            </p>
          )}
          {rows.map((order) => {
            const age = daysSince(order.created_at);
            return (
              <div key={order.id} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-verde-oliva/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-verde-profundo">
                      {order.campaign_numbers.map((n) => n.number.toString().padStart(3, "0")).join(" • ")}
                    </p>
                    <p className="truncate text-verde-oliva">{order.customer?.name ?? "-"}</p>
                    <p className="truncate text-xs text-verde-profundo/75">
                      {order.campaign?.name ?? "-"} · Cooperador: {order.seller?.full_name ?? "-"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-verde-profundo">{formatCentsBRL(order.total_cents)}</p>
                    <StatusBadge status={order.status as NumberStatus} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-verde-oliva">
                  Reservado em {formatDateTime(order.created_at)} · há {age} dia{age === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
