import { createClient } from "@/lib/supabase/server";
import type { Profile, Campaign } from "@/lib/database.types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

// The campaign sellers currently work against: the most recently created
// campaign that isn't a draft. Admins can still see/manage draft campaigns
// from Configurações.
export async function getActiveCampaign(): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .in("status", ["ATIVA", "PAUSADA", "ENCERRADA", "SORTEADA"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Campaign) ?? null;
}
