import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import { formatCentsBRL, formatDate } from "@/lib/format";
import TopBar from "@/components/TopBar";
import type { NumberStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const campaign = await getActiveCampaign();
  const profile = await getCurrentProfile();

  if (!campaign) {
    return (
      <>
        <TopBar title="Semeando Juntos" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <span className="text-4xl" aria-hidden>
            🌱
          </span>
          <h2 className="text-lg font-semibold text-verde-profundo">Nenhuma campanha ativa</h2>
          <p className="text-sm text-verde-oliva">
            {profile?.role === "admin"
              ? "Crie e ative uma campanha em Configurações para começar a vender."
              : "Peça a um administrador para ativar uma campanha."}
          </p>
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const { data: numbers } = await supabase
    .from("campaign_numbers")
    .select("status")
    .eq("campaign_id", campaign.id);

  const counts: Record<NumberStatus, number> = {
    DISPONIVEL: 0,
    RESERVADO: 0,
    AGUARDANDO_PAGAMENTO: 0,
    PAGO: 0,
    CANCELADO: 0,
  };
  (numbers ?? []).forEach((n) => {
    counts[n.status as NumberStatus]++;
  });

  const total = numbers?.length ?? 0;
  const arrecadadoCents = counts.PAGO * campaign.price_cents;
  const pendenteCents = (counts.RESERVADO + counts.AGUARDANDO_PAGAMENTO) * campaign.price_cents;
  const vendidos = counts.PAGO + counts.RESERVADO + counts.AGUARDANDO_PAGAMENTO;
  const pct = total > 0 ? Math.round((vendidos / total) * 1000) / 10 : 0;

  const cards = [
    { label: "Números", value: total, tone: "bg-white" },
    { label: "Pagos", value: counts.PAGO, tone: "bg-white" },
    { label: "Reservados", value: counts.RESERVADO + counts.AGUARDANDO_PAGAMENTO, tone: "bg-white" },
    { label: "Disponíveis", value: counts.DISPONIVEL, tone: "bg-white" },
  ];

  return (
    <>
      <TopBar title={campaign.name} />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-2xl ${c.tone} p-4 shadow-sm ring-1 ring-verde-oliva/10`}>
              <p className="text-2xl font-bold text-verde-profundo">{c.value}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-verde-oliva">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-verde-profundo p-4 text-off-white shadow-sm">
            <p className="text-2xl font-bold">{formatCentsBRL(arrecadadoCents)}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-off-white/70">Arrecadado</p>
          </div>
          <div className="rounded-2xl bg-terracota/90 p-4 text-off-white shadow-sm">
            <p className="text-2xl font-bold">{formatCentsBRL(pendenteCents)}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-off-white/70">Pendente</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
          <div className="mb-2 flex items-center justify-between text-sm font-medium text-verde-profundo">
            <span>
              {vendidos} / {total} vendidos
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-creme">
            <div
              className="h-full rounded-full bg-verde-oliva transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {campaign.payment_due_date && (
          <div className="rounded-xl bg-creme p-3 text-center text-sm font-medium text-verde-profundo">
            Prazo final de pagamento: {formatDate(campaign.payment_due_date)}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(profile?.role === "admin" || profile?.role === "seller") && (
            <Link
              href="/numeros?vender=1"
              className="tap-target flex items-center justify-center rounded-xl bg-terracota py-3 text-center font-semibold uppercase tracking-wide text-off-white hover:bg-terracota/90"
            >
              Vender número
            </Link>
          )}
          <Link
            href="/numeros"
            className="tap-target flex items-center justify-center rounded-xl bg-verde-profundo py-3 text-center font-semibold uppercase tracking-wide text-off-white hover:bg-verde-profundo/90"
          >
            Ver números
          </Link>
          {(profile?.role === "admin" || profile?.role === "treasurer") && (
            <Link
              href="/tesouraria"
              className="tap-target flex items-center justify-center rounded-xl bg-verde-oliva py-3 text-center font-semibold uppercase tracking-wide text-off-white hover:bg-verde-oliva/90"
            >
              Pagamentos
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
