/**
 * Seeds the SEMEANDO JUNTOS campaign described in the product spec:
 * 200 numbers (001-200) at R$ 20,00 each, draw on 2026-11-15, two vouchers.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npm run seed
 * Optionally set ADMIN_EMAIL and ADMIN_NAME to invite the first administrator.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar o seed.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  console.log("Criando campanha SEMEANDO JUNTOS...");

  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("name", "SEMEANDO JUNTOS")
    .maybeSingle();

  let campaignId = existing?.id as string | undefined;

  if (!campaignId) {
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        name: "SEMEANDO JUNTOS",
        description: "Campanha de arrecadação da igreja — venda assistida de números.",
        price_cents: 2000,
        number_count: 200,
        number_start: 1,
        draw_date: "2026-11-15",
        status: "ATIVA",
        reservation_hours: 24,
      })
      .select()
      .single();

    if (error || !campaign) {
      throw error ?? new Error("Falha ao criar campanha");
    }
    campaignId = campaign.id;
    console.log(`Campanha criada: ${campaignId}`);
  } else {
    console.log(`Campanha já existia: ${campaignId}`);
  }

  const { count } = await supabase
    .from("campaign_numbers")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (!count || count === 0) {
    console.log("Gerando números 001-200...");
    const numbers = Array.from({ length: 200 }, (_, i) => ({
      campaign_id: campaignId,
      number: i + 1,
      status: "DISPONIVEL" as const,
    }));
    const { error } = await supabase.from("campaign_numbers").insert(numbers);
    if (error) throw error;
  } else {
    console.log(`Números já existiam (${count}).`);
  }

  const { count: prizeCount } = await supabase
    .from("campaign_prizes")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (!prizeCount || prizeCount === 0) {
    console.log("Cadastrando prêmios...");
    const { error } = await supabase.from("campaign_prizes").insert([
      { campaign_id: campaignId, position: 1, title: "Voucher R$ 500,00 — Loja Moriah" },
      { campaign_id: campaignId, position: 2, title: "Voucher R$ 500,00 — Loja Virtuosa" },
    ]);
    if (error) throw error;
  } else {
    console.log("Prêmios já cadastrados.");
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminName = process.env.ADMIN_NAME;
  if (adminEmail && adminName) {
    console.log(`Convidando administrador ${adminEmail}...`);
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(adminEmail);
    if (inviteError) {
      console.warn(`Aviso: não foi possível convidar ${adminEmail}: ${inviteError.message}`);
    } else if (invited.user) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: invited.user.id,
        full_name: adminName,
        role: "admin",
        active: true,
      });
      if (profileError) console.warn(`Aviso ao criar perfil admin: ${profileError.message}`);
    }
  }

  console.log("Seed concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
