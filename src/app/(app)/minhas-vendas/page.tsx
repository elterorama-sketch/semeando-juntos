import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import { formatCentsBRL, formatNumber } from "@/lib/format";
import TopBar from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import type { NumberStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  status: NumberStatus | string;
  total_cents: number;
  created_at: string;
  customer: { name: string } | null;
  campaign_numbers: { number: number; status: NumberStatus }[];
}

export default async function MinhasVendasPage() {
  const profile = await getCurrentProfile();
  const campaign = await getActiveCampaign();

  if (!profile || !campaign) {
    return (
      <>
        <TopBar title="Minhas vendas" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa.</div>
      </>
    );
  }

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, total_cents, created_at, customer:customers(name), campaign_numbers(number, status)"
    )
    .eq("campaign_id", campaign.id)
    .eq("seller_id", profile.id)
    .neq("status", "CANCELADO")
    .order("created_at", { ascending: false });

  const list = (orders ?? []) as unknown as OrderRow[];

  const todayStr = new Date().toDateString();
  const today = list.filter((o) => new Date(o.created_at).toDateString() === todayStr);
  const pending = list.filter((o) => o.status !== "PAGO");
  const paid = list.filter((o) => o.status === "PAGO");

  const sum = (rows: OrderRow[]) => rows.reduce((acc, o) => acc + o.total_cents, 0);

  return (
    <>
      <TopBar title="Minhas vendas" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Hoje" count={today.length} totalCents={sum(today)} />
          <StatCard label="Pendentes" count={pending.length} totalCents={sum(pending)} />
          <StatCard label="Pagas" count={paid.length} totalCents={sum(paid)} />
        </div>

        <div className="space-y-2">
          {list.length === 0 && (
            <p className="py-10 text-center text-sm text-verde-oliva">
              Você ainda não registrou nenhuma venda nesta campanha.
            </p>
          )}
          {list.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-verde-oliva/10"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-verde-profundo">
                  {order.campaign_numbers.map((n) => formatNumber(n.number)).join(" • ")}
                </p>
                <p className="truncate text-sm text-verde-oliva">{order.customer?.name ?? "-"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-verde-profundo">{formatCentsBRL(order.total_cents)}</p>
                <StatusBadge status={order.status as NumberStatus} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

function StatCard({ label, count, totalCents }: { label: string; count: number; totalCents: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <p className="text-xs font-medium uppercase tracking-wide text-verde-oliva">{label}</p>
      <p className="mt-1 text-xl font-bold text-verde-profundo">{count}</p>
      <p className="text-sm text-verde-oliva">{formatCentsBRL(totalCents)}</p>
    </div>
  );
}
