"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/format";
import ActionButton from "@/components/ActionButton";

export default function DrawButton({
  campaignId,
  prizeId,
  eligibleCount,
}: {
  campaignId: string;
  prizeId: string;
  eligibleCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [winner, setWinner] = useState<{ number: number; customerName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDraw() {
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("execute_draw", {
      p_campaign_id: campaignId,
      p_prize_id: prizeId,
    });
    if (rpcError) {
      setError(
        rpcError.message.includes("SEM_NUMEROS_ELEGIVEIS")
          ? "Nenhum número pago disponível para sorteio."
          : "Erro ao sortear. Tente novamente."
      );
      throw rpcError;
    }
    const result = data?.[0];
    if (result) {
      setWinner({ number: result.number, customerName: result.customer_name });
    }
    setConfirming(false);
    router.refresh();
  }

  if (winner) {
    return (
      <div className="rounded-xl bg-verde-profundo p-4 text-center text-off-white">
        <p className="text-sm uppercase tracking-wide text-off-white/70">Vencedor</p>
        <p className="text-2xl font-bold">{formatNumber(winner.number)}</p>
        <p>{winner.customerName}</p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={eligibleCount === 0}
        className="tap-target w-full rounded-xl bg-terracota py-3 font-semibold uppercase tracking-wide text-off-white disabled:opacity-40"
      >
        Realizar sorteio
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-creme p-4">
      <p className="mb-1 font-semibold text-verde-profundo">Confirmar sorteio?</p>
      <p className="mb-3 text-sm text-verde-oliva">Somente números pagos participarão.</p>
      {error && <p className="mb-2 text-sm font-medium text-terracota">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="tap-target flex-1 rounded-xl bg-white py-3 font-semibold uppercase tracking-wide text-verde-profundo"
        >
          Cancelar
        </button>
        <div className="flex-1">
          <ActionButton label="Sortear" labelDoing="Sorteando..." onAction={handleDraw} variant="danger" />
        </div>
      </div>
    </div>
  );
}
