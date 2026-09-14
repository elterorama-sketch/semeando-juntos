import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import { formatCentsBRL } from "@/lib/format";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";

export const dynamic = "force-dynamic";

interface SellerStats {
  name: string;
  paidNumbers: number;
  paidCents: number;
  reservedNumbers: number;
  reservedCents: number;
}

export default async function RankingPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "treasurer")) {
    return (
      <>
        <TopBar title="Ranking de cooperadores" />
        <NoPermission />
      </>
    );
  }

  const campaign = await getActiveCampaign();
  if (!campaign) {
    return (
      <>
        <TopBar title="Ranking de cooperadores" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa.</div>
      </>
    );
  }

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("status, total_cents, seller:profiles!orders_seller_id_fkey(full_name), campaign_numbers(id)")
    .eq("campaign_id", campaign.id)
    .neq("status", "CANCELADO");

  const bySeller = new Map<string, SellerStats>();
  (orders ?? []).forEach((o) => {
    const seller = o as unknown as {
      status: string;
      total_cents: number;
      seller: { full_name: string } | null;
      campaign_numbers: { id: string }[];
    };
    const name = seller.seller?.full_name ?? "Desconhecido";
    const entry = bySeller.get(name) ?? {
      name,
      paidNumbers: 0,
      paidCents: 0,
      reservedNumbers: 0,
      reservedCents: 0,
    };
    const count = seller.campaign_numbers.length;
    if (seller.status === "PAGO") {
      entry.paidNumbers += count;
      entry.paidCents += seller.total_cents;
    } else {
      entry.reservedNumbers += count;
      entry.reservedCents += seller.total_cents;
    }
    bySeller.set(name, entry);
  });

  const ranking = Array.from(bySeller.values()).sort((a, b) => b.paidCents - a.paidCents);

  return (
    <>
      <TopBar title="Ranking de cooperadores" />
      <main className="flex-1 space-y-2 p-4 md:p-6">
        {ranking.length === 0 && (
          <p className="py-10 text-center text-sm text-verde-oliva">Nenhuma venda registrada ainda.</p>
        )}
        {ranking.map((s, i) => (
          <div
            key={s.name}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-verde-profundo font-bold text-off-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-verde-profundo">{s.name}</p>
                <p className="text-xs text-verde-oliva">
                  {s.paidNumbers} pagos · {s.reservedNumbers} reservados
                </p>
              </div>
            </div>
            <p className="shrink-0 font-bold text-verde-profundo">{formatCentsBRL(s.paidCents)}</p>
          </div>
        ))}
      </main>
    </>
  );
}
