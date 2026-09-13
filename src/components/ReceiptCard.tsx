"use client";

import { useEffect, useState } from "react";
import { formatCentsBRL, formatDate, formatNumber } from "@/lib/format";
import { generateReceiptImage } from "@/lib/receiptImage";

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
// instantly whether money still needs to change hands. The shareable output
// is a branded image (campaign poster palette) instead of plain text, so it
// looks like an official receipt when forwarded on WhatsApp.
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
  const [imageState, setImageState] = useState<"idle" | "generating" | "error">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    generateReceiptImage({
      status,
      campaignName,
      customerName,
      numbers,
      totalCents,
      changeCents,
      drawDate,
    })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setImageState("error");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShareImage() {
    setImageState("generating");
    try {
      const blob = await generateReceiptImage({
        status,
        campaignName,
        customerName,
        numbers,
        totalCents,
        changeCents,
        drawDate,
      });
      const fileName = `${campaignName.replace(/\s+/g, "-").toLowerCase()}-comprovante.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        setImageState("idle");
        try {
          await navigator.share({ files: [file], title: campaignName, text });
          return;
        } catch {
          // user cancelled the share sheet
          return;
        }
      }

      // Fallback: download the image directly.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setImageState("idle");
    } catch {
      setImageState("error");
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
        <div className="overflow-hidden rounded-2xl bg-verde-profundo shadow-lg">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Comprovante" className="block w-full" />
          ) : (
            <div className="flex aspect-[4/5] w-full items-center justify-center">
              <p className="text-sm text-creme/70">Gerando comprovante...</p>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleShareImage}
            disabled={imageState === "generating"}
            className="tap-target w-full rounded-xl bg-terracota py-3 font-semibold uppercase tracking-wide text-off-white hover:bg-terracota/90 disabled:opacity-60"
          >
            {imageState === "generating" ? "Gerando imagem..." : "Compartilhar imagem"}
          </button>
          {imageState === "error" && (
            <p className="text-center text-sm font-medium text-terracota">
              Não foi possível gerar a imagem. Tente novamente.
            </p>
          )}
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
