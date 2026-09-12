"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCentsBRL } from "@/lib/format";
import ActionButton from "@/components/ActionButton";
import type { PaymentMethod } from "@/lib/database.types";

export default function ConfirmPaymentButton({
  orderId,
  totalCents,
}: {
  orderId: string;
  totalCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("confirm_payment", {
      p_order_id: orderId,
      p_amount_cents: totalCents,
      p_method: method,
    });
    if (rpcError) {
      setError("Erro ao confirmar. Tente novamente.");
      throw rpcError;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target rounded-xl bg-verde-profundo px-4 py-2 text-sm font-semibold uppercase tracking-wide text-off-white hover:bg-verde-profundo/90"
      >
        Confirmar {formatCentsBRL(totalCents)}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-creme p-3">
      <div className="mb-2 flex gap-2">
        {(["PIX", "DINHEIRO", "OUTRO"] as PaymentMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`tap-target flex-1 rounded-lg py-2 text-xs font-semibold ${
              method === m ? "bg-verde-profundo text-off-white" : "bg-white text-verde-profundo"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      {error && <p className="mb-2 text-xs font-medium text-terracota">{error}</p>}
      <ActionButton
        label={`Confirmar ${formatCentsBRL(totalCents)}`}
        labelDoing="Confirmando..."
        labelDone="Pagamento confirmado ✓"
        onAction={handleConfirm}
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="tap-target mt-1 w-full rounded-lg py-2 text-xs font-medium text-verde-oliva"
      >
        Cancelar
      </button>
    </div>
  );
}
