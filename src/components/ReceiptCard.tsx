"use client";

import { useState } from "react";
import { formatCentsBRL, formatDate, formatNumber } from "@/lib/format";

interface ReceiptCardProps {
  status?: "paid" | "reserved";
  campaignName: string;
  customerName: string;
  numbers: number[];
  totalCents: number;
  changeCents?: number | null;
  drawDate: string | null;
  onClose: () => void;
}

// Modeled after a card-machine (maquineta) confirmation screen: a full,
// unmistakable color signal (green = approved/paid, yellow = pending) so a
// seller glancing at the phone from across the room -- or the buyer -- knows
// instantly whether money still needs to change hands, plus a share button
// to hand the receipt straight to the buyer.
export default function ReceiptCard({
  status = "paid",
  campaignName,
  customerName,
  numbers,
  totalCents,
  changeCents,
  drawDate,
  onClose,
}: ReceiptCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const isPaid = status === "paid";

  const text = [
    campaignName.toUpperCase(),
    "",
    isPaid ? "PAGAMENTO CONFIRMADO ✓" : "RESERVADO — AGUARDANDO PAGAMENTO",
    "",
    customerName,
    "",
    "Números:",
    numbers.map((n) => formatNumber(n)).join(" • "),
    "",
    `Valor: ${formatCentsBRL(totalCents)}`,
    changeCents && changeCents > 0 ? `Troco: ${formatCentsBRL(changeCents)}` : null,
    drawDate ? `Sorteio: ${formatDate(drawDate)}` : null,
    "",
    isPaid ? "Obrigado por participar!" : "Aguardamos o pagamento para confirmar sua participação.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text, title: campaignName });
        return;
      } catch {
        // user cancelled the share sheet — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1800);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
        <div
          className={`rounded-2xl p-5 text-center ${
            isPaid ? "bg-emerald-600 text-white" : "bg-amber-400 text-verde-profundo"
          }`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-widest ${
              isPaid ? "text-white/70" : "text-verde-profundo/70"
            }`}
          >
            {campaignName}
          </p>
          <p className="mt-3 text-2xl" aria-hidden>
            {isPaid ? "✓" : "⏳"}
          </p>
          <p className="mt-1 text-lg font-bold">
            {isPaid ? "PAGAMENTO CONFIRMADO" : "AGUARDANDO PAGAMENTO"}
          </p>
          <p className="mt-3 font-medium">{customerName}</p>
          <p className={`mt-2 text-sm ${isPaid ? "text-white/80" : "text-verde-profundo/70"}`}>
            Números
          </p>
          <p className="text-xl font-bold tracking-wide">
            {numbers.map((n) => formatNumber(n)).join(" • ")}
          </p>
          <p className="mt-3 text-2xl font-bold">{formatCentsBRL(totalCents)}</p>
          {isPaid && changeCents != null && changeCents > 0 && (
            <p className="mt-1 text-sm font-semibold">Troco: {formatCentsBRL(changeCents)}</p>
          )}
          {drawDate && (
            <p className={`mt-2 text-sm ${isPaid ? "text-white/80" : "text-verde-profundo/70"}`}>
              Sorteio em {formatDate(drawDate)}
            </p>
          )}
          <p className={`mt-4 text-sm italic ${isPaid ? "text-white/70" : "text-verde-profundo/70"}`}>
            {isPaid ? "Obrigado por participar!" : "Confirme o pagamento assim que possível."}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleShare}
            className="tap-target w-full rounded-xl bg-terracota py-3 font-semibold uppercase tracking-wide text-off-white hover:bg-terracota/90"
          >
            Compartilhar
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="tap-target w-full rounded-xl bg-creme py-3 font-semibold uppercase tracking-wide text-verde-profundo hover:bg-creme/70"
          >
            {copyState === "copied" ? "Texto copiado ✓" : "Copiar texto"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="tap-target w-full rounded-xl py-3 font-semibold uppercase tracking-wide text-verde-oliva hover:bg-creme/40"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
