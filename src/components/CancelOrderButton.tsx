"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCentsBRL, formatNumber } from "@/lib/format";
import { reportUnexpectedRpcError } from "@/lib/reportError";
import ActionButton from "@/components/ActionButton";

// Cancelar uma reserva simples (RESERVADO/AGUARDANDO_PAGAMENTO) é uma ação
// de rotina -- um clique, sem motivo. Cancelar uma venda já PAGA desfaz um
// pagamento confirmado, então pede confirmação com motivo opcional (fica
// registrado em audit_logs e aparece no relatório de cancelamentos).
// Compartilhado entre o detalhe do número (DetailDrawer) e a lista de
// vendas (compradores/minhas vendas mescladas).
export default function CancelOrderButton({
  orderId,
  status,
  numbers,
  customerName,
  totalCents,
  onDone,
  compact = true,
}: {
  orderId: string;
  status: string;
  numbers: number[];
  customerName: string;
  totalCents: number;
  onDone: () => void;
  // true (padrão): botão pequeno pra caber numa linha de lista. false: botão
  // de largura total, como as outras ações do detalhe do número.
  compact?: boolean;
}) {
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function release(reason?: string) {
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("release_order", {
      p_order_id: orderId,
      p_reason: reason?.trim() || null,
    });
    if (rpcError) {
      reportUnexpectedRpcError(supabase, "release_order", rpcError.message, { orderId });
      setError(
        status === "PAGO" ? "Erro ao cancelar a compra. Tente novamente." : "Erro ao liberar o número. Tente novamente."
      );
      throw rpcError;
    }
    onDone();
  }

  if (status === "PAGO") {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowReasonModal(true)}
          className={
            compact
              ? "tap-target rounded-lg bg-terracota/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-terracota hover:bg-terracota/20"
              : "tap-target w-full rounded-xl bg-terracota py-3 font-semibold uppercase tracking-wide text-off-white hover:bg-terracota/90"
          }
        >
          Cancelar compra
        </button>
        {showReasonModal && (
          <CancelPurchaseModal
            customerName={customerName}
            numbers={numbers}
            totalCents={totalCents}
            error={error}
            onClose={() => setShowReasonModal(false)}
            onConfirm={release}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <ActionButton
        label={compact ? "Liberar" : "Liberar número"}
        labelDoing="Liberando..."
        labelDone="Liberado ✓"
        variant={compact ? "ghost" : "danger"}
        fullWidth={!compact}
        className={compact ? "px-3 py-2 text-xs" : undefined}
        onAction={() => release()}
      />
      {error && <p className="mt-1 text-xs font-medium text-terracota">{error}</p>}
    </div>
  );
}

function CancelPurchaseModal({
  customerName,
  numbers,
  totalCents,
  error,
  onClose,
  onConfirm,
}: {
  customerName: string;
  numbers: number[];
  totalCents: number;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
        <h3 className="text-lg font-bold text-verde-profundo">Cancelar esta compra?</h3>
        <p className="mt-2 text-sm text-verde-oliva">
          O pagamento já havia sido confirmado. Cancelar devolve{" "}
          {numbers.length === 1 ? "o número" : "os números"}{" "}
          <span className="font-semibold text-verde-profundo">
            {numbers.map((n) => formatNumber(n)).join(" • ")}
          </span>{" "}
          para disponível e desfaz a venda de {formatCentsBRL(totalCents)} de{" "}
          <span className="font-semibold text-verde-profundo">{customerName}</span>. Isso fica
          registrado no relatório de cancelamentos.
        </p>

        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-verde-oliva">Motivo (opcional)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ex: comprador desistiu, pagamento estornado, erro no registro..."
            className="tap-target w-full rounded-xl border border-verde-oliva/30 px-3 py-2 text-sm outline-none focus:border-verde-profundo"
          />
        </label>

        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-terracota">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <ActionButton
            label="Cancelar compra"
            labelDoing="Cancelando..."
            labelDone="Cancelado ✓"
            variant="danger"
            onAction={() => onConfirm(reason)}
          />
          <button
            type="button"
            onClick={onClose}
            className="tap-target w-full rounded-xl py-3 font-semibold uppercase tracking-wide text-verde-oliva hover:bg-creme/40"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
