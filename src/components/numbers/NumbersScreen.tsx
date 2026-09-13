"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/format";
import { statusConfig } from "@/components/StatusBadge";
import SellDrawer from "@/components/numbers/SellDrawer";
import DetailDrawer from "@/components/numbers/DetailDrawer";
import ReceiptCard from "@/components/ReceiptCard";
import type { Campaign, CampaignNumber, Congregation, NumberStatus, Profile } from "@/lib/database.types";

type GridNumber = Pick<
  CampaignNumber,
  "id" | "number" | "status" | "order_id" | "reserved_by" | "expires_at"
>;

const FILTERS: { key: "TODOS" | NumberStatus; label: string }[] = [
  { key: "TODOS", label: "Todos" },
  { key: "DISPONIVEL", label: "Disponíveis" },
  { key: "RESERVADO", label: "Reservados" },
  { key: "AGUARDANDO_PAGAMENTO", label: "Pendentes" },
  { key: "PAGO", label: "Pagos" },
];

export default function NumbersScreen({
  campaign,
  profile,
  initialNumbers,
  profiles,
  congregations,
}: {
  campaign: Campaign;
  profile: Profile;
  initialNumbers: GridNumber[];
  profiles: { id: string; full_name: string; role: string }[];
  congregations: Congregation[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [numbers, setNumbers] = useState<GridNumber[]>(initialNumbers);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("TODOS");
  const [search, setSearch] = useState("");
  const [matchedNumberIds, setMatchedNumberIds] = useState<Set<string> | null>(null);
  const [multiMode, setMultiMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sellNumbers, setSellNumbers] = useState<number[] | null>(null);
  const [detailId, setDetailId] = useState<{ id: string; number: number; status: NumberStatus } | null>(
    null
  );
  const [receipt, setReceipt] = useState<{ numbers: number[]; customerName: string; totalCents: number } | null>(
    null
  );
  const [randomCount, setRandomCount] = useState(5);
  const [showRandomPicker, setShowRandomPicker] = useState(false);

  const canSell = profile.role === "admin" || profile.role === "seller";
  const profileNameById = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("campaign_numbers")
      .select("id, number, status, order_id, reserved_by, expires_at")
      .eq("campaign_id", campaign.id)
      .order("number", { ascending: true });
    if (data) setNumbers(data as GridNumber[]);
  }, [campaign.id]);

  // Realtime: any reservation/payment/release by any seller reflects here
  // immediately, so two people never see a stale "disponível" for the same
  // number.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`campaign-numbers-${campaign.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_numbers", filter: `campaign_id=eq.${campaign.id}` },
        (payload) => {
          setNumbers((prev) => {
            const updated = payload.new as GridNumber;
            if (payload.eventType === "DELETE") {
              return prev.filter((n) => n.id !== (payload.old as GridNumber).id);
            }
            const exists = prev.some((n) => n.id === updated.id);
            if (exists) {
              return prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n));
            }
            return [...prev, updated].sort((a, b) => a.number - b.number);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaign.id]);

  // Open the sell drawer straight away when arriving via the "Vender"
  // shortcut (bottom nav / dashboard button) with no number chosen yet.
  useEffect(() => {
    if (searchParams.get("vender") === "1" && canSell) {
      setShowRandomPicker(true);
    }
  }, [searchParams, canSell]);

  useEffect(() => {
    let cancelled = false;
    async function runSearch() {
      const q = search.trim();
      if (!q) {
        setMatchedNumberIds(null);
        return;
      }
      if (/^\d+$/.test(q)) {
        setMatchedNumberIds(null); // handled by simple numeric filter below
        return;
      }
      const supabase = createClient();
      const ids = new Set<string>();

      const { data: byCustomer } = await supabase
        .from("orders")
        .select("id, customer:customers!inner(name), campaign_id")
        .eq("campaign_id", campaign.id)
        .ilike("customer.name", `%${q}%`);
      const orderIds = (byCustomer ?? []).map((o) => o.id);

      const matchingSellerIds = profiles
        .filter((p) => p.full_name.toLowerCase().includes(q.toLowerCase()))
        .map((p) => p.id);

      const { data: byNumbers } = await supabase
        .from("campaign_numbers")
        .select("id, order_id, reserved_by")
        .eq("campaign_id", campaign.id);

      (byNumbers ?? []).forEach((n) => {
        if ((n.order_id && orderIds.includes(n.order_id)) || (n.reserved_by && matchingSellerIds.includes(n.reserved_by))) {
          ids.add(n.id);
        }
      });

      if (!cancelled) setMatchedNumberIds(ids);
    }
    const t = setTimeout(runSearch, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, campaign.id, profiles]);

  const filtered = useMemo(() => {
    let list = numbers;
    if (filter !== "TODOS") list = list.filter((n) => n.status === filter);

    const q = search.trim();
    if (q) {
      if (/^\d+$/.test(q)) {
        list = list.filter((n) => n.number.toString().includes(q));
      } else if (matchedNumberIds) {
        list = list.filter((n) => matchedNumberIds.has(n.id));
      }
    }
    return list;
  }, [numbers, filter, search, matchedNumberIds]);

  function toggleSelect(n: GridNumber) {
    if (n.status !== "DISPONIVEL") {
      setDetailId({ id: n.id, number: n.number, status: n.status });
      return;
    }
    if (!canSell) return;

    if (!multiMode) {
      setSellNumbers([n.number]);
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n.number)) next.delete(n.number);
      else next.add(n.number);
      return next;
    });
  }

  function pickRandom(count: number) {
    const available = numbers.filter((n) => n.status === "DISPONIVEL");
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, available.length)).map((n) => n.number);
    setShowRandomPicker(false);
    if (picked.length > 0) setSellNumbers(picked);
  }

  return (
    <main className="flex-1 p-4 md:p-6">
      <div className="mb-4 space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número, comprador ou vendedor"
          aria-label="Buscar"
          className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 outline-none focus:border-verde-profundo focus:ring-2 focus:ring-verde-profundo/20"
        />

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`tap-target shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                filter === f.key ? "bg-verde-profundo text-off-white" : "bg-creme text-verde-profundo"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {canSell && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMultiMode((m) => !m);
                setSelected(new Set());
              }}
              className={`tap-target rounded-xl px-3 py-2 text-sm font-semibold ${
                multiMode ? "bg-verde-profundo text-off-white" : "bg-creme text-verde-profundo"
              }`}
            >
              {multiMode ? "Cancelar seleção múltipla" : "Selecionar vários"}
            </button>
            <button
              type="button"
              onClick={() => pickRandom(1)}
              className="tap-target rounded-xl bg-creme px-3 py-2 text-sm font-semibold text-verde-profundo"
            >
              Escolher número aleatório
            </button>
            <button
              type="button"
              onClick={() => setShowRandomPicker(true)}
              className="tap-target rounded-xl bg-creme px-3 py-2 text-sm font-semibold text-verde-profundo"
            >
              Escolher vários aleatórios
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-verde-oliva">Nenhum número encontrado.</p>
      )}

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {filtered.map((n) => {
          const config = statusConfig(n.status);
          const isSelected = selected.has(n.number);
          const sellerName = n.reserved_by ? profileNameById.get(n.reserved_by) : undefined;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => toggleSelect(n)}
              title={`${formatNumber(n.number)} — ${config.label}${sellerName ? ` — ${sellerName}` : ""}`}
              aria-label={`Número ${formatNumber(n.number)}, ${config.label}`}
              className={`tap-target flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-semibold transition ${
                isSelected ? "ring-2 ring-terracota" : ""
              } ${config.classes}`}
            >
              <span className="text-sm font-bold">{formatNumber(n.number)}</span>
              <span aria-hidden className="text-[10px]">
                {config.icon}
              </span>
            </button>
          );
        })}
      </div>

      {multiMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 md:bottom-4">
          <button
            type="button"
            onClick={() => setSellNumbers(Array.from(selected))}
            className="tap-target w-full max-w-md rounded-xl bg-terracota py-3 text-center font-semibold uppercase tracking-wide text-off-white shadow-lg"
          >
            Vender {selected.size} número{selected.size > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {showRandomPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-sm rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
            <h3 className="mb-3 text-lg font-bold text-verde-profundo">Quantos números?</h3>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setRandomCount((c) => Math.max(1, c - 1))}
                className="tap-target h-11 w-11 rounded-full bg-creme text-xl font-bold text-verde-profundo"
              >
                -
              </button>
              <span className="w-10 text-center text-2xl font-bold text-verde-profundo">{randomCount}</span>
              <button
                type="button"
                onClick={() => setRandomCount((c) => c + 1)}
                className="tap-target h-11 w-11 rounded-full bg-creme text-xl font-bold text-verde-profundo"
              >
                +
              </button>
            </div>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => pickRandom(randomCount)}
                className="tap-target w-full rounded-xl bg-verde-profundo py-3 font-semibold uppercase tracking-wide text-off-white"
              >
                Escolher {randomCount}
              </button>
              <button
                type="button"
                onClick={() => setShowRandomPicker(false)}
                className="tap-target w-full rounded-xl py-3 font-semibold uppercase tracking-wide text-verde-oliva"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {sellNumbers && (
        <SellDrawer
          campaignId={campaign.id}
          priceCents={campaign.price_cents}
          numbers={sellNumbers}
          congregations={congregations}
          promoBuyQuantity={campaign.promo_buy_quantity}
          promoFreeQuantity={campaign.promo_free_quantity}
          onClose={() => setSellNumbers(null)}
          onSold={(result) => {
            setSellNumbers(null);
            setSelected(new Set());
            setMultiMode(false);
            refresh();
            router.replace("/numeros");
          }}
        />
      )}

      {detailId && (
        <DetailDrawer
          numberId={detailId.id}
          numberValue={detailId.number}
          status={detailId.status}
          profile={profile}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
          onPaymentConfirmed={(info) => setReceipt({ ...info, numbers: info.numbers })}
        />
      )}

      {receipt && (
        <ReceiptCard
          campaignName={campaign.name}
          customerName={receipt.customerName}
          numbers={receipt.numbers}
          totalCents={receipt.totalCents}
          drawDate={campaign.draw_date}
          onClose={() => setReceipt(null)}
        />
      )}
    </main>
  );
}
