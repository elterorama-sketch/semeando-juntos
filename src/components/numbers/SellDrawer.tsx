"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCentsBRL, formatNumber } from "@/lib/format";
import ActionButton from "@/components/ActionButton";
import type { Congregation, PaymentMethod } from "@/lib/database.types";

interface SellDrawerProps {
  campaignId: string;
  priceCents: number;
  numbers: number[];
  congregations: Congregation[];
  promoBuyQuantity: number | null;
  promoFreeQuantity: number | null;
  onClose: () => void;
  onSold: (result: { numbers: number[]; customerName: string; totalCents: number }) => void;
}

// Mirrors the pricing/validation math in reserve_numbers() (see
// supabase/migrations/0009_enforce_promo_completion.sql) so the seller
// sees the real total -- and gets blocked from stopping right at a
// "compre 10" threshold without its bonus -- before submitting, not only
// after the RPC rejects it.
function promoState(
  count: number,
  buyQty: number | null,
  freeQty: number | null
): { units: number; shortfall: number } {
  if (!buyQty || !freeQty) return { units: count, shortfall: 0 };
  const groupSize = buyQty + freeQty;
  const tens = Math.floor(count / buyQty);
  const requiredMin = tens * groupSize;
  const shortfall = requiredMin - count;
  if (shortfall > 0) return { units: count, shortfall };
  return { units: tens * buyQty + (count - requiredMin), shortfall: 0 };
}

type Mode = "reservar" | "vender";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "PIX", label: "PIX" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "OUTRO", label: "Outro" },
];

export default function SellDrawer({
  campaignId,
  priceCents,
  numbers,
  congregations,
  promoBuyQuantity,
  promoFreeQuantity,
  onClose,
  onSold,
}: SellDrawerProps) {
  const [mode, setMode] = useState<Mode>("reservar");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [note, setNote] = useState("");
  const [congregationId, setCongregationId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [error, setError] = useState<string | null>(null);

  const { units, shortfall } = promoState(numbers.length, promoBuyQuantity, promoFreeQuantity);
  const totalCents = priceCents * units;
  const fullPriceCents = priceCents * numbers.length;
  const hasDiscount = shortfall === 0 && units < numbers.length;
  const sorted = [...numbers].sort((a, b) => a - b);

  async function handleReserve() {
    setError(null);
    if (shortfall > 0) {
      setError(
        `Selecione mais ${shortfall} número${shortfall > 1 ? "s" : ""} para completar a promoção.`
      );
      throw new Error("validation");
    }
    if (!name.trim()) {
      setError("Informe o nome do comprador.");
      throw new Error("validation");
    }
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("reserve_numbers", {
      p_campaign_id: campaignId,
      p_numbers: sorted,
      p_customer_name: name.trim(),
      p_customer_whatsapp: whatsapp.trim() || null,
      p_note: note.trim() || null,
      p_congregation_id: congregationId || null,
      p_payment_method: mode === "vender" ? paymentMethod : null,
    });

    if (rpcError) {
      const friendly = translateError(rpcError.message);
      setError(friendly);
      throw rpcError;
    }

    onSold({ numbers: sorted, customerName: name.trim(), totalCents });
  }

  const title =
    numbers.length === 1 ? `Número ${formatNumber(sorted[0])}` : `${numbers.length} números selecionados`;

  const actionLabel =
    mode === "reservar"
      ? numbers.length === 1
        ? `Reservar ${formatNumber(sorted[0])}`
        : `Reservar ${numbers.length} números`
      : numbers.length === 1
        ? `Vender ${formatNumber(sorted[0])}`
        : `Vender ${numbers.length} números`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-verde-profundo">{title}</h2>
            {numbers.length > 1 && (
              <p className="mt-1 text-sm text-verde-oliva">
                {sorted.map((n) => formatNumber(n)).join(" • ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="tap-target rounded-full text-xl text-verde-oliva hover:bg-creme"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex rounded-xl bg-creme p-1">
          <button
            type="button"
            onClick={() => setMode("reservar")}
            className={`tap-target flex-1 rounded-lg py-2 text-sm font-semibold ${
              mode === "reservar" ? "bg-verde-profundo text-off-white" : "text-verde-profundo"
            }`}
          >
            Reservar
          </button>
          <button
            type="button"
            onClick={() => setMode("vender")}
            className={`tap-target flex-1 rounded-lg py-2 text-sm font-semibold ${
              mode === "vender" ? "bg-verde-profundo text-off-white" : "text-verde-profundo"
            }`}
          >
            Vender agora
          </button>
        </div>
        <p className="mb-4 text-xs text-verde-oliva">
          {mode === "reservar"
            ? "Segura o número para o comprador; a forma de pagamento fica em aberto até confirmar depois."
            : "Já registra a forma de pagamento prevista agora."}
        </p>

        <div
          className={`mb-4 rounded-xl p-3 text-center ${shortfall > 0 ? "bg-terracota/10" : "bg-creme"}`}
        >
          {shortfall > 0 ? (
            <>
              <p className="font-semibold text-terracota">
                Faltam {shortfall} número{shortfall > 1 ? "s" : ""} para a promoção
              </p>
              <p className="mt-1 text-xs text-terracota">
                Selecionando exatamente {numbers.length}, nenhum número sai de graça. Adicione mais{" "}
                {shortfall} para completar o grupo e garantir o bônus.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-verde-oliva">Total</p>
              {hasDiscount && (
                <p className="text-sm text-verde-oliva line-through">{formatCentsBRL(fullPriceCents)}</p>
              )}
              <p className="text-2xl font-bold text-verde-profundo">{formatCentsBRL(totalCents)}</p>
              {hasDiscount && (
                <p className="mt-1 text-xs font-semibold text-terracota">
                  Promoção aplicada — pagando {units} de {numbers.length} números
                </p>
              )}
            </>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="customer-name" className="mb-1 block text-sm font-medium text-verde-profundo">
              Nome do comprador *
            </label>
            <input
              id="customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 outline-none focus:border-verde-profundo focus:ring-2 focus:ring-verde-profundo/20"
            />
          </div>
          <div>
            <label htmlFor="customer-whatsapp" className="mb-1 block text-sm font-medium text-verde-profundo">
              WhatsApp
            </label>
            <input
              id="customer-whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 outline-none focus:border-verde-profundo focus:ring-2 focus:ring-verde-profundo/20"
            />
          </div>

          {congregations.length > 0 && (
            <div>
              <label htmlFor="customer-congregation" className="mb-1 block text-sm font-medium text-verde-profundo">
                Congregação
              </label>
              <select
                id="customer-congregation"
                value={congregationId}
                onChange={(e) => setCongregationId(e.target.value)}
                className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 outline-none focus:border-verde-profundo focus:ring-2 focus:ring-verde-profundo/20"
              >
                <option value="">Não informado</option>
                {congregations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "vender" && (
            <div>
              <p className="mb-1 text-sm font-medium text-verde-profundo">Forma de pagamento</p>
              <div className="flex gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentMethod(opt.value)}
                    className={`tap-target flex-1 rounded-xl py-2 text-sm font-semibold ${
                      paymentMethod === opt.value
                        ? "bg-verde-profundo text-off-white"
                        : "bg-creme text-verde-profundo"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="note" className="mb-1 block text-sm font-medium text-verde-profundo">
              Observação
            </label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="tap-target w-full rounded-xl border border-verde-oliva/30 bg-white px-4 py-3 outline-none focus:border-verde-profundo focus:ring-2 focus:ring-verde-profundo/20"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-terracota">
            {error}
          </p>
        )}

        <div className="mt-5">
          <ActionButton
            label={actionLabel}
            labelDoing={mode === "reservar" ? "Reservando..." : "Vendendo..."}
            labelDone={mode === "reservar" ? "Reservado ✓" : "Vendido ✓"}
            onAction={handleReserve}
            disabled={shortfall > 0}
          />
        </div>
      </div>
    </div>
  );
}

function translateError(message: string): string {
  if (message.includes("NUMERO_INDISPONIVEL")) {
    return "NÚMERO INDISPONÍVEL — acabou de ser reservado por outra pessoa. Escolha outro.";
  }
  if (message.includes("CAMPANHA_INATIVA")) {
    return "Esta campanha não está aceitando vendas no momento.";
  }
  if (message.includes("NOME_COMPRADOR_OBRIGATORIO")) {
    return "Informe o nome do comprador.";
  }
  if (message.includes("PERMISSAO_NEGADA")) {
    return "Você não tem permissão para vender números.";
  }
  if (message.includes("PROMOCAO_INCOMPLETA")) {
    return "Selecione mais números para completar a promoção antes de continuar.";
  }
  return "Erro ao salvar. Tente novamente.";
}
