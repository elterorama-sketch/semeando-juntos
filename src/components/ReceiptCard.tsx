"use client";

import { useState } from "react";
import { formatCentsBRL, formatDate, formatNumber } from "@/lib/format";

interface ReceiptCardProps {
  campaignName: string;
  customerName: string;
  numbers: number[];
  totalCents: number;
  drawDate: string | null;
  onClose: () => void;
}

export default function ReceiptCard({
  campaignName,
  customerName,
  numbers,
  totalCents,
  drawDate,
  onClose,
}: ReceiptCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const text = [
    campaignName.toUpperCase(),
    "",
    "PAGAMENTO CONFIRMADO ✓",
    "",
    customerName,
    "",
    "Números:",
    numbers.map((n) => formatNumber(n)).join(" • "),
    "",
    `Valor: ${formatCentsBRL(totalCents)}`,
    drawDate ? `Sorteio: ${formatDate(drawDate)}` : null,
    "",
    "Obrigado por participar!",
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
        <div className="rounded-2xl bg-verde-profundo p-5 text-center text-off-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-off-white/70">
            {campaignName}
          </p>
          <p className="mt-3 text-lg font-bold">PAGAMENTO CONFIRMADO ✓</p>
          <p className="mt-3 font-medium">{customerName}</p>
          <p className="mt-2 text-sm text-off-white/80">Números</p>
          <p className="text-xl font-bold tracking-wide">
            {numbers.map((n) => formatNumber(n)).join(" • ")}
          </p>
          <p className="mt-3 text-2xl font-bold">{formatCentsBRL(totalCents)}</p>
          {drawDate && (
            <p className="mt-2 text-sm text-off-white/80">Sorteio em {formatDate(drawDate)}</p>
          )}
          <p className="mt-4 text-sm italic text-off-white/70">Obrigado por participar!</p>
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
