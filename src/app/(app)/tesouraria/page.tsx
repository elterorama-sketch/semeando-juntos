import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import { formatCentsBRL, formatNumber } from "@/lib/format";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";
import ConfirmPaymentButton from "@/components/ConfirmPaymentButton";

export const dynamic = "force-dynamic";

export default async function TesourariaPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "treasurer")) {
    return (
      <>
        <TopBar title="Tesouraria" />
        <NoPermission />
      </>
    );
  }

  const campaign = await getActiveCampaign();
  if (!campaign) {
    return (
      <>
        <TopBar title="Tesouraria" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa.</div>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: numbers }, { data: pendingOrders }, { data: paymentsToday }] = await Promise.all([
    supabase.from("campaign_numbers").select("status").eq("campaign_id", campaign.id),
    supabase
      .from("orders")
      .select(
        "id, total_cents, created_at, intended_payment_method, customer:customers(name, congregation:congregations(name)), seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(number)"
      )
      .eq("campaign_id", campaign.id)
      .in("status", ["RESERVADO", "AGUARDANDO_PAGAMENTO"])
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("amount_cents, confirmed_at, order:orders!inner(campaign_id)")
      .eq("order.campaign_id", campaign.id),
  ]);

  const paidCount = (numbers ?? []).filter((n) => n.status === "PAGO").length;
  const pendingCount = (numbers ?? []).filter(
    (n) => n.status === "RESERVADO" || n.status === "AGUARDANDO_PAGAMENTO"
  ).length;
  const arrecadado = paidCount * campaign.price_cents;
  const aReceber = pendingCount * campaign.price_cents;

  const todayStr = new Date().toDateString();
  const pagamentosHoje = (paymentsToday ?? []).filter(
    (p) => new Date(p.confirmed_at).toDateString() === todayStr
  );
  const pagamentosHojeCents = pagamentosHoje.reduce((acc, p) => acc + p.amount_cents, 0);

  return (
    <>
      <TopBar title="Tesouraria" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Arrecadado" value={formatCentsBRL(arrecadado)} />
          <Card label="A receber" value={formatCentsBRL(aReceber)} />
          <Card label="Pagamentos hoje" value={formatCentsBRL(pagamentosHojeCents)} />
          <Card label="Reservas pendentes" value={String(pendingOrders?.length ?? 0)} />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-verde-oliva">
            Aguardando confirmação
          </h2>
          <div className="space-y-2">
            {(pendingOrders ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-verde-oliva">Nenhuma reserva pendente.</p>
            )}
            {(pendingOrders ?? []).map((order) => (
              <div
                key={order.id}
                className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-verde-oliva/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-verde-profundo">
                      {
                        (order as unknown as { customer: { name: string; congregation: { name: string } | null } | null })
                          .customer?.name ?? "-"
                      }
                    </p>
                    {(order as unknown as { customer: { congregation: { name: string } | null } | null }).customer
                      ?.congregation && (
                      <p className="text-xs text-verde-oliva/70">
                        {
                          (order as unknown as { customer: { congregation: { name: string } | null } | null })
                            .customer!.congregation!.name
                        }
                      </p>
                    )}
                    <p className="text-sm text-verde-oliva">
                      {(order as unknown as { campaign_numbers: { number: number }[] }).campaign_numbers
                        .map((n) => formatNumber(n.number))
                        .join(" • ")}
                    </p>
                    <p className="text-xs text-verde-oliva/70">
                      Vendedor:{" "}
                      {(order as unknown as { seller: { full_name: string } | null }).seller?.full_name ?? "-"}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <ConfirmPaymentButton
                    orderId={order.id}
                    totalCents={order.total_cents}
                    initialMethod={
                      (order as unknown as { intended_payment_method: string | null }).intended_payment_method as
                        | "PIX"
                        | "DINHEIRO"
                        | "OUTRO"
                        | null
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <p className="text-xs font-medium uppercase tracking-wide text-verde-oliva">{label}</p>
      <p className="mt-1 text-lg font-bold text-verde-profundo">{value}</p>
    </div>
  );
}
