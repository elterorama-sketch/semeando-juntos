import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import { formatCentsBRL } from "@/lib/format";
import TopBar from "@/components/TopBar";
import VendasList, { type VendaRow } from "@/components/VendasList";

export const dynamic = "force-dynamic";

// Antes duas telas separadas -- "Compradores" (todo mundo via campanha) e
// "Minhas vendas" (só as do vendedor logado) -- mostrando essencialmente a
// mesma informação de formas diferentes. Mesclado numa só: admin/tesoureiro
// veem tudo, vendedor vê só as próprias, e agora dá pra cancelar direto
// daqui (sem precisar abrir o número no grid).
export default async function VendasPage() {
  const profile = await getCurrentProfile();
  const campaign = await getActiveCampaign();

  if (!profile || !campaign) {
    return (
      <>
        <TopBar title="Vendas" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa.</div>
      </>
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, status, total_cents, created_at, customer:customers(name, whatsapp, congregation:congregations(name)), seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(number)"
    )
    .eq("campaign_id", campaign.id)
    .neq("status", "CANCELADO")
    .order("created_at", { ascending: false });

  if (profile.role === "seller") {
    query = query.eq("seller_id", profile.id);
  }

  const { data: orders } = await query;
  const list = (orders ?? []) as unknown as VendaRow[];

  const todayStr = new Date().toDateString();
  const today = list.filter((o) => new Date(o.created_at).toDateString() === todayStr);
  const pending = list.filter((o) => o.status !== "PAGO");
  const paid = list.filter((o) => o.status === "PAGO");
  const sum = (rows: VendaRow[]) => rows.reduce((acc, o) => acc + o.total_cents, 0);

  return (
    <>
      <TopBar title="Vendas" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Hoje" count={today.length} totalCents={sum(today)} />
          <StatCard label="Pendentes" count={pending.length} totalCents={sum(pending)} />
          <StatCard label="Pagas" count={paid.length} totalCents={sum(paid)} />
        </div>

        <VendasList orders={list} role={profile.role} showSeller={profile.role !== "seller"} />
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
