import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import TopBar from "@/components/TopBar";
import NumbersScreen from "@/components/numbers/NumbersScreen";

export const dynamic = "force-dynamic";

export default async function NumerosPage() {
  const campaign = await getActiveCampaign();
  const profile = await getCurrentProfile();

  if (!campaign || !profile) {
    return (
      <>
        <TopBar title="Números" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa no momento.</div>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: numbers }, { data: profiles }] = await Promise.all([
    supabase
      .from("campaign_numbers")
      .select("id, number, status, order_id, reserved_by, expires_at")
      .eq("campaign_id", campaign.id)
      .order("number", { ascending: true }),
    supabase.from("profiles").select("id, full_name, role"),
  ]);

  return (
    <>
      <TopBar title={campaign.name} />
      <NumbersScreen
        campaign={campaign}
        profile={profile}
        initialNumbers={numbers ?? []}
        profiles={profiles ?? []}
      />
    </>
  );
}
