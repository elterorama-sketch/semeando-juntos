"use client";

import { useRouter } from "next/navigation";
import { formatCentsBRL, formatDateTime, formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import CancelOrderButton from "@/components/CancelOrderButton";
import type { NumberStatus, UserRole } from "@/lib/database.types";

export interface VendaRow {
  id: string;
  status: NumberStatus | string;
  total_cents: number;
  created_at: string;
  customer: { name: string; whatsapp: string | null; congregation: { name: string } | null } | null;
  seller: { full_name: string } | null;
  campaign_numbers: { number: number }[];
}

export default function VendasList({
  orders,
  role,
  showSeller,
}: {
  orders: VendaRow[];
  // Mesma regra do detalhe do número (DetailDrawer): admin/tesoureiro podem
  // cancelar qualquer venda, inclusive já paga; vendedor só a própria
  // reserva não paga. A RPC release_order confere tudo de novo no servidor
  // -- isto só decide se o botão aparece.
  role: UserRole;
  // admin/tesoureiro veem de quem é cada venda; o próprio vendedor não
  // precisa ver o nome dele repetido em toda linha.
  showSeller: boolean;
}) {
  const router = useRouter();

  if (orders.length === 0) {
    return <p className="py-10 text-center text-sm text-verde-oliva">Nenhuma venda registrada ainda.</p>;
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <div key={order.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-verde-oliva/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-verde-profundo">
                {order.campaign_numbers.map((n) => formatNumber(n.number)).join(" • ")}
              </p>
              <p className="truncate text-sm text-verde-oliva">{order.customer?.name ?? "-"}</p>
              {order.customer?.whatsapp && (
                <p className="truncate text-xs text-verde-profundo/75">{order.customer.whatsapp}</p>
              )}
              {order.customer?.congregation && (
                <p className="truncate text-xs text-verde-profundo/75">{order.customer.congregation.name}</p>
              )}
              {showSeller && order.seller && (
                <p className="truncate text-xs text-verde-profundo/75">Cooperador: {order.seller.full_name}</p>
              )}
              <p className="mt-1 text-xs text-verde-oliva">{formatDateTime(order.created_at)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold text-verde-profundo">{formatCentsBRL(order.total_cents)}</p>
              <StatusBadge status={order.status as NumberStatus} />
            </div>
          </div>
          {order.status !== "CANCELADO" &&
            (role === "admin" || role === "treasurer" || (role === "seller" && order.status !== "PAGO")) && (
            <div className="mt-2 flex justify-end">
              <CancelOrderButton
                orderId={order.id}
                status={order.status as string}
                numbers={order.campaign_numbers.map((n) => n.number)}
                customerName={order.customer?.name ?? "Comprador não disponível"}
                totalCents={order.total_cents}
                onDone={() => router.refresh()}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
