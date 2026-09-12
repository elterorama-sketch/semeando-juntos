"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCentsBRL, formatDateTime, formatNumber } from "@/lib/format";
import ActionButton from "@/components/ActionButton";
import type { NumberStatus, PaymentMethod, Profile } from "@/lib/database.types";

interface OrderDetail {
  id: string;
  status: string;
  total_cents: number;
  note: string | null;
  expires_at: string | null;
  intended_payment_method: PaymentMethod | null;
  customer: {
    id: string;
    name: string;
    whatsapp: string | null;
    congregation: { name: string } | null;
  } | null;
  seller: { full_name: string } | null;
  payments: { amount_cents: number; method: PaymentMethod; confirmed_at: string }[];
}

interface DetailDrawerProps {
  numberId: string;
  numberValue: number;
  status: NumberStatus;
  profile: Profile;
  onClose: () => void;
  onChanged: () => void;
  onPaymentConfirmed: (info: { numbers: number[]; customerName: string; totalCents: number }) => void;
}

export default function DetailDrawer({
  numberId,
  numberValue,
  status,
  profile,
  onClose,
  onChanged,
  onPaymentConfirmed,
}: DetailDrawerProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("campaign_numbers")
        .select(
          "order:orders(id, status, total_cents, note, expires_at, intended_payment_method, customer:customers(id, name, whatsapp, congregation:congregations(name)), seller:profiles!orders_seller_id_fkey(full_name), payments(amount_cents, method, confirmed_at))"
        )
        .eq("id", numberId)
        .single();
      if (!cancelled) {
        setOrder((data?.order as unknown as OrderDetail) ?? null);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [numberId]);

  const canConfirmPayment = profile.role === "admin" || profile.role === "treasurer";
  const canRelease =
    status !== "CANCELADO" &&
    (profile.role === "admin" ||
      profile.role === "treasurer" ||
      (profile.role === "seller" && status !== "PAGO"));

  async function handleRelease() {
    setError(null);
    if (!order) return;
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("release_order", { p_order_id: order.id });
    if (rpcError) {
      setError("Erro ao liberar o número. Tente novamente.");
      throw rpcError;
    }
    onChanged();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold text-verde-profundo">Número {formatNumber(numberValue)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="tap-target rounded-full text-xl text-verde-oliva hover:bg-creme"
          >
            ✕
          </button>
        </div>

        {loading && <p className="text-sm text-verde-oliva">Carregando...</p>}

        {!loading && !order && (
          <p className="text-sm text-verde-oliva">Sem detalhes disponíveis para este número.</p>
        )}

        {!loading && order && (
          <div className="space-y-3">
            <div className="rounded-xl bg-creme p-3">
              <p className="font-semibold text-verde-profundo">{order.customer?.name ?? "Comprador não disponível"}</p>
              {order.customer?.whatsapp && (
                <p className="text-sm text-verde-oliva">{order.customer.whatsapp}</p>
              )}
              {order.customer?.congregation && (
                <p className="text-sm text-verde-oliva">{order.customer.congregation.name}</p>
              )}
              {order.seller && (
                <p className="mt-1 text-sm text-verde-oliva">Vendedor: {order.seller.full_name}</p>
              )}
              {order.note && <p className="mt-1 text-sm italic text-verde-oliva">{order.note}</p>}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-verde-oliva/10">
              <span className="text-sm text-verde-oliva">Total</span>
              <span className="font-bold text-verde-profundo">{formatCentsBRL(order.total_cents)}</span>
            </div>

            {order.expires_at && status === "RESERVADO" && (
              <p className="text-xs text-verde-oliva">Expira em {formatDateTime(order.expires_at)}</p>
            )}

            {order.intended_payment_method && status !== "PAGO" && (
              <p className="text-xs text-verde-oliva">
                Forma prevista: {order.intended_payment_method}
              </p>
            )}

            {order.payments?.length > 0 && (
              <div className="rounded-xl bg-verde-oliva/10 p-3 text-sm text-verde-profundo">
                Pago em {formatDateTime(order.payments[0].confirmed_at)} via {order.payments[0].method}
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-terracota">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-2">
          {canConfirmPayment && status !== "PAGO" && status !== "CANCELADO" && order && (
            <button
              type="button"
              onClick={() => setShowPayment(true)}
              className="tap-target w-full rounded-xl bg-verde-profundo py-3 font-semibold uppercase tracking-wide text-off-white hover:bg-verde-profundo/90"
            >
              Confirmar pagamento
            </button>
          )}
          {canRelease && order && (
            <ActionButton
              label={status === "PAGO" ? "Liberar número pago" : "Liberar número"}
              labelDoing="Liberando..."
              labelDone="Liberado ✓"
              variant="danger"
              onAction={handleRelease}
            />
          )}
        </div>

        {showPayment && order && order.customer && (
          <PaymentModal
            orderId={order.id}
            customerName={order.customer.name}
            numbers={[numberValue]}
            totalCents={order.total_cents}
            initialMethod={order.intended_payment_method}
            onClose={() => setShowPayment(false)}
            onConfirmed={() => {
              setShowPayment(false);
              onChanged();
              onPaymentConfirmed({
                numbers: [numberValue],
                customerName: order.customer!.name,
                totalCents: order.total_cents,
              });
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

function PaymentModal({
  orderId,
  customerName,
  numbers,
  totalCents,
  initialMethod,
  onClose,
  onConfirmed,
}: {
  orderId: string;
  customerName: string;
  numbers: number[];
  totalCents: number;
  initialMethod?: PaymentMethod | null;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>(initialMethod ?? "PIX");
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
      setError(
        rpcError.message.includes("PAGAMENTO_DUPLICADO")
          ? "Este pedido já foi confirmado como pago."
          : "Erro ao confirmar pagamento. Tente novamente."
      );
      throw rpcError;
    }
    onConfirmed();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
        <h3 className="text-lg font-bold text-verde-profundo">Pagamento recebido?</h3>
        <p className="mt-2 text-sm text-verde-oliva">Comprador</p>
        <p className="font-semibold text-verde-profundo">{customerName}</p>
        <p className="mt-2 text-sm text-verde-oliva">Números</p>
        <p className="font-semibold text-verde-profundo">{numbers.map((n) => formatNumber(n)).join(" • ")}</p>

        <div className="mt-3">
          <p className="mb-1 text-sm text-verde-oliva">Forma</p>
          <div className="flex gap-2">
            {(["PIX", "DINHEIRO", "OUTRO"] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`tap-target flex-1 rounded-xl py-2 text-sm font-semibold ${
                  method === m ? "bg-verde-profundo text-off-white" : "bg-creme text-verde-profundo"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-terracota">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <ActionButton
            label={`Confirmar ${formatCentsBRL(totalCents)}`}
            labelDoing="Confirmando..."
            labelDone="Pagamento confirmado ✓"
            onAction={handleConfirm}
          />
          <button
            type="button"
            onClick={onClose}
            className="tap-target w-full rounded-xl py-3 font-semibold uppercase tracking-wide text-verde-oliva hover:bg-creme/40"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
