import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/session";
import TopBar from "@/components/TopBar";
import NoPermission from "@/components/NoPermission";
import CampaignSettingsForm from "@/components/admin/CampaignSettingsForm";
import PrizesEditor from "@/components/admin/PrizesEditor";
import InviteUserForm from "@/components/admin/InviteUserForm";
import UsersList from "@/components/admin/UsersList";
import NewCampaignForm from "@/components/admin/NewCampaignForm";
import CongregationsEditor from "@/components/admin/CongregationsEditor";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import type { Campaign, CampaignPrize, Congregation, Profile } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return (
      <>
        <TopBar title="Configurações" />
        <NoPermission />
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: campaigns }, { data: users }, { data: congregations }] = await Promise.all([
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("congregations").select("*").order("name"),
  ]);

  const currentCampaign = (campaigns ?? [])[0] as Campaign | undefined;
  let prizes: CampaignPrize[] = [];
  if (currentCampaign) {
    const { data } = await supabase
      .from("campaign_prizes")
      .select("*")
      .eq("campaign_id", currentCampaign.id)
      .order("position");
    prizes = data ?? [];
  }

  return (
    <>
      <TopBar title="Configurações" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <ChangePasswordForm />

        {currentCampaign ? (
          <>
            <CampaignSettingsForm campaign={currentCampaign} />
            <PrizesEditor campaignId={currentCampaign.id} prizes={prizes} />
          </>
        ) : (
          <p className="rounded-xl bg-creme p-4 text-sm text-verde-oliva">
            Nenhuma campanha cadastrada ainda. Crie a primeira campanha abaixo.
          </p>
        )}

        <NewCampaignForm />

        <CongregationsEditor congregations={(congregations ?? []) as Congregation[]} />

        <InviteUserForm congregations={(congregations ?? []) as Congregation[]} />
        <UsersList
          users={(users ?? []) as Profile[]}
          congregations={(congregations ?? []) as Congregation[]}
        />
      </main>
    </>
  );
}
