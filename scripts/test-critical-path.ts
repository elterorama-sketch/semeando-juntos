/**
 * Teste automatizado do caminho crítico (item 3 do plano "Como evitar
 * erros no sistema"): reservar → vender → confirmar pagamento → liberar,
 * simulando um vendedor real autenticado (não service role -- os RPCs
 * exigem auth.uid() de uma sessão de verdade, então este script faz
 * login de verdade com um usuário de teste dedicado).
 *
 * IMPORTANTE -- não há ambiente de homologação ainda (item 5 do plano),
 * então este teste roda contra a MESMA campanha ativa de produção: a
 * tabela `campaigns` tem uma constraint (`one_active_campaign_at_a_time`)
 * que permite só UMA campanha com status ATIVA por vez, então não dá pra
 * criar uma campanha de teste isolada sem pausar a campanha real. Em vez
 * disso, o teste pega 2 números realmente disponíveis da campanha ativa,
 * reserva/vende com um comprador claramente marcado como teste, e libera
 * tudo de volta em segundos -- se outra pessoa pegar exatamente um desses
 * números no meio do teste, o RPC responde NUMERO_INDISPONIVEL e o script
 * tenta outro número, sem quebrar. O risco residual de um número real
 * ficar reservado por 1-2s a mais é aceitável para pegar bugs de verdade
 * cedo; eliminar esse risco de vez é o que o item 5 (staging) resolve.
 *
 * É exatamente o teste que teria pego o bug do order_numbers antes de
 * qualquer cooperador ver o erro: reserva → libera → reserva de novo o
 * mesmo número (isso falhava com "duplicate key value violates unique
 * constraint" antes da correção em 0019_fix_order_numbers_orphan_bug.sql).
 *
 * Uso: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *      SUPABASE_SERVICE_ROLE_KEY=... npm run test:critical-path
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY antes de rodar."
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey);

const TEST_SELLER_EMAIL = "teste-automatizado@semeando-juntos.app";
const TEST_CUSTOMER_PREFIX = "__TESTE_AUTOMATIZADO__";

let passed = 0;
let failed = 0;

function ok(step: string) {
  passed++;
  console.log(`  ✅ ${step}`);
}

function fail(step: string, detail: unknown) {
  failed++;
  console.error(`  ❌ ${step}`);
  console.error(`     ${detail instanceof Error ? detail.message : JSON.stringify(detail)}`);
}

async function assert(step: string, fn: () => Promise<void>) {
  try {
    await fn();
    ok(step);
  } catch (err) {
    fail(step, err);
  }
}

async function getActiveCampaignWithSpareNumbers(): Promise<{
  campaignId: string;
  candidates: number[];
}> {
  const { data: campaign, error } = await admin
    .from("campaigns")
    .select("id")
    .eq("status", "ATIVA")
    .maybeSingle();
  if (error) throw error;
  if (!campaign) {
    throw new Error(
      "Nenhuma campanha ATIVA no momento -- não dá pra testar reservar/vender sem uma. Crie/ative uma campanha e rode de novo."
    );
  }

  const { data: numbers, error: numbersError } = await admin
    .from("campaign_numbers")
    .select("number")
    .eq("campaign_id", campaign.id)
    .eq("status", "DISPONIVEL")
    .order("number", { ascending: false })
    .limit(10);
  if (numbersError) throw numbersError;
  if (!numbers || numbers.length < 2) {
    throw new Error("Menos de 2 números disponíveis na campanha ativa -- não dá pra testar com segurança.");
  }

  return { campaignId: campaign.id, candidates: numbers.map((n) => n.number) };
}

async function ensureTestSeller(): Promise<{ userId: string; password: string }> {
  const password = crypto.randomBytes(9).toString("base64url");

  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = usersPage?.users.find((u) => u.email === TEST_SELLER_EMAIL);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) throw error;
    return { userId: existing.id, password };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: TEST_SELLER_EMAIL,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error("Falha ao criar vendedor de teste");

  await admin.from("profiles").insert({
    id: created.user.id,
    full_name: "Vendedor de Teste (automatizado)",
    role: "seller",
    active: true,
  });

  return { userId: created.user.id, password };
}

// Tenta reservar o primeiro número livre da lista de candidatos; se outra
// pessoa acabou de pegar exatamente esse número (NUMERO_INDISPONIVEL),
// tenta o próximo -- não deveria acontecer quase nunca, mas o teste não
// pode quebrar por causa de uma venda real coincidindo no mesmo instante.
async function reserveWithRetry(
  seller: SupabaseClient,
  campaignId: string,
  candidates: number[],
  customerName: string,
  paymentMethod?: "DINHEIRO" | "PIX" | "OUTRO"
): Promise<{ number: number; orderId: string }> {
  let lastError: unknown;
  for (const number of candidates) {
    const { data, error } = await seller.rpc("reserve_numbers", {
      p_campaign_id: campaignId,
      p_numbers: [number],
      p_customer_name: customerName,
      p_payment_method: paymentMethod ?? null,
    });
    if (!error && data?.[0]?.order_id) {
      return { number, orderId: data[0].order_id };
    }
    lastError = error;
    if (!error?.message.includes("NUMERO_INDISPONIVEL")) break;
  }
  throw lastError ?? new Error("Nenhum número disponível para reservar");
}

// Não depende dos order_id guardados em variáveis (o teste pode ter
// quebrado no meio e deixado alguma etapa sem rodar) -- em vez disso,
// encontra tudo pelo prefixo do nome do cliente de teste e desfaz a
// partir daí, então funciona mesmo depois de uma falha parcial.
async function cleanup() {
  const { data: testCustomers } = await admin
    .from("customers")
    .select("id")
    .like("name", `${TEST_CUSTOMER_PREFIX}%`);
  const testCustomerIds = (testCustomers ?? []).map((c) => c.id);
  if (testCustomerIds.length > 0) {
    const { data: testOrders } = await admin
      .from("orders")
      .select("id")
      .in("customer_id", testCustomerIds);
    const testOrderIds = (testOrders ?? []).map((o) => o.id);
    if (testOrderIds.length > 0) {
      await admin
        .from("campaign_numbers")
        .update({
          status: "DISPONIVEL",
          order_id: null,
          reserved_by: null,
          reserved_at: null,
          expires_at: null,
        })
        .in("order_id", testOrderIds);
      await admin.from("order_numbers").delete().in("order_id", testOrderIds);
      await admin.from("payments").delete().in("order_id", testOrderIds);
      await admin.from("orders").delete().in("id", testOrderIds);
    }
    await admin.from("customers").delete().in("id", testCustomerIds);
  }
}

async function main() {
  console.log("Teste do caminho crítico: reservar → vender → confirmar → liberar\n");

  const { campaignId, candidates } = await getActiveCampaignWithSpareNumbers();
  const { password } = await ensureTestSeller();

  const seller: SupabaseClient = createClient(url!, anonKey!);
  const { error: signInError } = await seller.auth.signInWithPassword({
    email: TEST_SELLER_EMAIL,
    password,
  });
  if (signInError) {
    fail("Login do vendedor de teste", signInError);
    process.exit(1);
  }
  ok("Login do vendedor de teste");

  let numberA: number | undefined;
  let orderIdA: string | undefined;

  // Regressão do bug do order_numbers: reservar -> liberar -> reservar de
  // novo o MESMO número. Falhava com "duplicate key" antes da correção.
  await assert("Reservar um número disponível", async () => {
    const result = await reserveWithRetry(seller, campaignId, candidates, `${TEST_CUSTOMER_PREFIX}A`);
    numberA = result.number;
    orderIdA = result.orderId;
  });

  await assert("Liberar o número reservado", async () => {
    if (!orderIdA) throw new Error("sem order_id da etapa anterior");
    const { error } = await seller.rpc("release_order", { p_order_id: orderIdA });
    if (error) throw error;
  });

  await assert("Reservar de novo o MESMO número (regressão order_numbers)", async () => {
    if (!numberA) throw new Error("sem número da etapa anterior");
    const { data, error } = await seller.rpc("reserve_numbers", {
      p_campaign_id: campaignId,
      p_numbers: [numberA],
      p_customer_name: `${TEST_CUSTOMER_PREFIX}A2`,
    });
    if (error) throw error;
    orderIdA = data?.[0]?.order_id;
  });

  // Vender agora: reservar + confirmar pagamento na hora, como o botão
  // "Vender agora" faz -- o fluxo relatado no áudio do cooperador.
  let orderIdB: string | undefined;
  let priceCents: number | undefined;
  await assert("Reservar e vender um segundo número (Vender agora)", async () => {
    const remaining = candidates.filter((n) => n !== numberA);
    const result = await reserveWithRetry(seller, campaignId, remaining, `${TEST_CUSTOMER_PREFIX}B`, "DINHEIRO");
    orderIdB = result.orderId;
    const { data: order } = await admin.from("orders").select("total_cents").eq("id", orderIdB).single();
    priceCents = order?.total_cents;
  });

  await assert("Confirmar pagamento em dinheiro", async () => {
    if (!orderIdB || priceCents == null) throw new Error("sem order_id/preço da etapa anterior");
    const { error } = await seller.rpc("confirm_payment", {
      p_order_id: orderIdB,
      p_amount_cents: priceCents,
      p_method: "DINHEIRO",
    });
    if (error) throw error;
  });

  await assert("Confirmar pagamento duplicado é rejeitado", async () => {
    if (!orderIdB || priceCents == null) throw new Error("sem order_id/preço da etapa anterior");
    const { error } = await seller.rpc("confirm_payment", {
      p_order_id: orderIdB,
      p_amount_cents: priceCents,
      p_method: "DINHEIRO",
    });
    if (!error || !error.message.includes("PAGAMENTO_DUPLICADO")) {
      throw new Error("deveria ter rejeitado com PAGAMENTO_DUPLICADO");
    }
  });

  await cleanup();
  ok("Limpeza dos dados de teste (números liberados, pedidos/clientes de teste removidos)");

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("Erro inesperado no teste:", err);
  process.exit(1);
});
