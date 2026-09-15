import { createClient } from "@/lib/supabase/server";
import { getActiveCampaign, getCurrentProfile } from "@/lib/session";
import { formatCentsBRL, formatNumber } from "@/lib/format";
import TopBar from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import type { NumberStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

interface CustomerGroup {
  name: string;
  whatsapp: string | null;
  congregation: string | null;
  numbers: number[];
  totalCents: number;
  status: NumberStatus;
}

export default async function CompradoresPage() {
  const profile = await getCurrentProfile();
  const campaign = await getActiveCampaign();

  if (!profile || !campaign) {
    return (
      <>
        <TopBar title="Compradores" />
        <div className="p-6 text-center text-verde-oliva">Nenhuma campanha ativa.</div>
      </>
    );
  }

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "total_cents, status, customer:customers(name, whatsapp, congregation:congregations(name)), campaign_numbers(number)"
    )
    .eq("campaign_id", campaign.id)
    .neq("status", "CANCELADO")
    .order("created_at", { ascending: false });

  const byCustomer = new Map<string, CustomerGroup>();
  (orders ?? []).forEach((o) => {
    const row = o as unknown as {
      total_cents: number;
      status: NumberStatus;
      customer: {
        name: string;
        whatsapp: string | null;
        congregation: { name: string } | null;
      } | null;
      campaign_numbers: { number: number }[];
    };
    if (!row.customer) return;
    const key = `${row.customer.name}|${row.customer.whatsapp ?? ""}`;
    const entry = byCustomer.get(key) ?? {
      name: row.customer.name,
      whatsapp: row.customer.whatsapp,
      congregation: row.customer.congregation?.name ?? null,
      numbers: [],
      totalCents: 0,
      status: row.status,
    };
    entry.numbers.push(...row.campaign_numbers.map((n) => n.number));
    entry.totalCents += row.total_cents;
    byCustomer.set(key, entry);
  });

  const list = Array.from(byCustomer.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <TopBar title="Compradores" />
      <main className="flex-1 space-y-2 p-4 md:p-6">
        {list.length === 0 && (
          <p className="py-10 text-center text-sm text-verde-oliva">Nenhum comprador registrado ainda.</p>
        )}
        {list.map((c) => (
          <div key={c.name + c.whatsapp} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-verde-profundo">{c.name}</p>
                {c.whatsapp && <p className="truncate text-sm text-verde-oliva">{c.whatsapp}</p>}
                {c.congregation && (
                  <p className="truncate text-xs text-verde-profundo/75">{c.congregation}</p>
                )}
                <p className="mt-1 text-sm text-verde-oliva">
                  {c.numbers.length} número{c.numbers.length > 1 ? "s" : ""} ·{" "}
                  {c.numbers.map((n) => formatNumber(n)).join(" • ")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-verde-profundo">{formatCentsBRL(c.totalCents)}</p>
                <StatusBadge status={c.status} />
              </div>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
