"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ActionButton from "@/components/ActionButton";
import type { Campaign, CampaignStatus } from "@/lib/database.types";

const STATUS_OPTIONS: CampaignStatus[] = ["RASCUNHO", "ATIVA", "PAUSADA", "ENCERRADA", "SORTEADA"];
const RESERVATION_OPTIONS = [
  { label: "6 horas", value: 6 },
  { label: "12 horas", value: 12 },
  { label: "24 horas", value: 24 },
  { label: "48 horas", value: 48 },
  { label: "Sem expiração", value: null },
];

export default function CampaignSettingsForm({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description ?? "");
  const [priceReais, setPriceReais] = useState((campaign.price_cents / 100).toFixed(2));
  const [drawDate, setDrawDate] = useState(campaign.draw_date ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [reservationHours, setReservationHours] = useState<number | null>(campaign.reservation_hours);
  const [paymentDueDate, setPaymentDueDate] = useState(campaign.payment_due_date ?? "");
  const [promoEnabled, setPromoEnabled] = useState(campaign.promo_buy_quantity !== null);
  const [promoBuy, setPromoBuy] = useState(String(campaign.promo_buy_quantity ?? 10));
  const [promoFree, setPromoFree] = useState(String(campaign.promo_free_quantity ?? 1));
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const priceCents = Math.round(parseFloat(priceReais.replace(",", ".")) * 100);
    if (!name.trim() || Number.isNaN(priceCents) || priceCents <= 0) {
      setError("Verifique o nome e o valor por número.");
      throw new Error("validation");
    }

    const promoBuyN = parseInt(promoBuy, 10);
    const promoFreeN = parseInt(promoFree, 10);
    if (promoEnabled && (Number.isNaN(promoBuyN) || promoBuyN <= 0 || Number.isNaN(promoFreeN) || promoFreeN <= 0)) {
      setError("Verifique os números da promoção.");
      throw new Error("validation");
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        price_cents: priceCents,
        draw_date: drawDate || null,
        status,
        reservation_hours: reservationHours,
        payment_due_date: paymentDueDate || null,
        promo_buy_quantity: promoEnabled ? promoBuyN : null,
        promo_free_quantity: promoEnabled ? promoFreeN : null,
      })
      .eq("id", campaign.id);

    if (updateError) {
      setError(
        updateError.message.includes("one_active_campaign_at_a_time")
          ? "Já existe outra campanha ATIVA. Pause ou encerre a outra antes de ativar esta."
          : "Erro ao salvar. Tente novamente."
      );
      throw updateError;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-verde-oliva/10">
      <h3 className="font-semibold text-verde-profundo">Campanha</h3>

      <Field label="Nome">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
      </Field>

      <Field label="Descrição">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
      </Field>

      <Field label="Valor por número (R$)">
        <input
          value={priceReais}
          onChange={(e) => setPriceReais(e.target.value)}
          inputMode="decimal"
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
      </Field>

      <Field label="Data do sorteio">
        <input
          type="date"
          value={drawDate}
          onChange={(e) => setDrawDate(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
      </Field>

      <Field label="Status">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`tap-target rounded-xl px-3 py-2 text-xs font-semibold ${
                status === s ? "bg-verde-profundo text-off-white" : "bg-creme text-verde-profundo"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Prazo de reserva (por número)">
        <div className="flex flex-wrap gap-2">
          {RESERVATION_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setReservationHours(opt.value)}
              className={`tap-target rounded-xl px-3 py-2 text-xs font-semibold ${
                reservationHours === opt.value ? "bg-verde-profundo text-off-white" : "bg-creme text-verde-profundo"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Data máxima de pagamento (opcional)">
        <input
          type="date"
          value={paymentDueDate}
          onChange={(e) => setPaymentDueDate(e.target.value)}
          className="tap-target w-full rounded-xl border border-verde-oliva/30 px-4 py-3 outline-none focus:border-verde-profundo"
        />
        <p className="mt-1 text-xs text-verde-oliva">
          Depois dessa data, qualquer reserva pendente da campanha expira automaticamente — mesmo
          que o prazo por número ainda não tenha vencido.
        </p>
      </Field>

      <Field label="Promoção por quantidade (opcional)">
        <button
          type="button"
          onClick={() => setPromoEnabled((v) => !v)}
          className={`tap-target w-full rounded-xl py-2 text-sm font-semibold ${
            promoEnabled ? "bg-verde-profundo text-off-white" : "bg-creme text-verde-profundo"
          }`}
        >
          {promoEnabled ? "Promoção ativada" : "Ativar promoção"}
        </button>
        {promoEnabled && (
          <div className="mt-2 flex items-center gap-2 text-sm text-verde-profundo">
            <span>Compre</span>
            <input
              value={promoBuy}
              onChange={(e) => setPromoBuy(e.target.value)}
              inputMode="numeric"
              className="tap-target w-16 rounded-xl border border-verde-oliva/30 px-2 py-2 text-center outline-none focus:border-verde-profundo"
            />
            <span>ganhe</span>
            <input
              value={promoFree}
              onChange={(e) => setPromoFree(e.target.value)}
              inputMode="numeric"
              className="tap-target w-16 rounded-xl border border-verde-oliva/30 px-2 py-2 text-center outline-none focus:border-verde-profundo"
            />
            <span>grátis</span>
          </div>
        )}
        {promoEnabled && (
          <p className="mt-1 text-xs text-verde-oliva">
            Ex: compre {promoBuy || "10"} ganhe {promoFree || "1"} — a cada grupo de{" "}
            {(parseInt(promoBuy || "0", 10) || 0) + (parseInt(promoFree || "0", 10) || 0)} números na
            mesma venda, o comprador paga só {promoBuy || "10"}. Números fora de um grupo completo
            saem no preço cheio.
          </p>
        )}
      </Field>

      {error && <p className="text-sm font-medium text-terracota">{error}</p>}

      <ActionButton label="Salvar campanha" labelDoing="Salvando..." labelDone="Salvo ✓" onAction={handleSave} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-verde-profundo">{label}</label>
      {children}
    </div>
  );
}
