"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCentsBRL, formatNumber } from "@/lib/format";
import ActionButton from "@/components/ActionButton";

interface SellDrawerProps {
  campaignId: string;
  priceCents: number;
  numbers: number[];
  onClose: () => void;
  onSold: (result: { numbers: number[]; customerName: string; totalCents: number }) => void;
}

export default function SellDrawer({
  campaignId,
  priceCents,
  numbers,
  onClose,
  onSold,
}: SellDrawerProps) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const totalCents = priceCents * numbers.length;
  const sorted = [...numbers].sort((a, b) => a - b);

  async function handleReserve() {
    setError(null);
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

        <div className="mb-4 rounded-xl bg-creme p-3 text-center">
          <p className="text-xs uppercase tracking-wide text-verde-oliva">Total</p>
          <p className="text-2xl font-bold text-verde-profundo">{formatCentsBRL(totalCents)}</p>
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
            label={numbers.length === 1 ? `Reservar ${formatNumber(sorted[0])}` : `Vender ${numbers.length} números`}
            labelDoing="Reservando..."
            labelDone="Reservado ✓"
            onAction={handleReserve}
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
  return "Erro ao salvar. Tente novamente.";
}
