import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import { formatDateTime, formatNumber } from "@/lib/format";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";
import DrawButton from "@/components/DrawButton";

export const dynamic = "force-dynamic";

export default async function SorteioPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return (
      <>
        <TopBar title="Sorteio" />
        <NoPermission />
      </>
    );
  }

  const campaign = await getActiveCampaign();
  if (!campaign) {
    return (
      <>
        <TopBar title="Sorteio" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa.</div>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: prizes }, { data: eligible }] = await Promise.all([
    supabase.from("campaign_prizes").select("*").eq("campaign_id", campaign.id).order("position"),
    supabase.from("campaign_numbers").select("id").eq("campaign_id", campaign.id).eq("status", "PAGO"),
  ]);

  const { data: results } = await supabase
    .from("draw_results")
    .select(
      "id, created_at, prize:campaign_prizes(id, title, position), campaign_number:campaign_numbers(number), customer:customers(name)"
    )
    .in("prize_id", (prizes ?? []).map((p) => p.id));

  return (
    <>
      <TopBar title="Sorteio" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="rounded-xl bg-creme p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-verde-oliva">Números elegíveis</p>
          <p className="text-2xl font-bold text-verde-profundo">{eligible?.length ?? 0}</p>
        </div>

        <div className="space-y-3">
          {(prizes ?? []).map((prize) => {
            const result = (results ?? []).find(
              (r) => (r as unknown as { prize: { id: string } }).prize.id === prize.id
            ) as unknown as
              | { campaign_number: { number: number }; customer: { name: string }; created_at: string }
              | undefined;
            return (
              <div key={prize.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
                <p className="font-semibold text-verde-profundo">
                  {prize.position}º prêmio — {prize.title}
                </p>
                {prize.description && <p className="text-sm text-verde-oliva">{prize.description}</p>}

                <div className="mt-3">
                  {result ? (
                    <div className="rounded-xl bg-verde-profundo p-4 text-center text-off-white">
                      <p className="text-sm uppercase tracking-wide text-off-white/70">Vencedor</p>
                      <p className="text-2xl font-bold">{formatNumber(result.campaign_number.number)}</p>
                      <p>{result.customer.name}</p>
                      <p className="mt-1 text-xs text-off-white/70">{formatDateTime(result.created_at)}</p>
                    </div>
                  ) : (
                    <DrawButton
                      campaignId={campaign.id}
                      prizeId={prize.id}
                      eligibleCount={eligible?.length ?? 0}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {(prizes ?? []).length === 0 && (
            <p className="py-10 text-center text-sm text-verde-oliva">
              Cadastre os prêmios em Configurações para habilitar o sorteio.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
