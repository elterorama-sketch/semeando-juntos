"use client";

import { useEffect, useMemo, useState } from "react";
import { generatePromoImage } from "@/lib/promoImage";
import type { CampaignLeader } from "@/lib/campaignLeaders";
import { PROMO_TEMPLATES, pickPromoTemplate, pickPosterHeadline } from "@/lib/promoTemplates";

interface PromoShareButtonProps {
  campaignName: string;
  priceCents: number;
  drawDate: string | null;
  prizes: { position: number; title: string }[];
  promoBuyQuantity: number | null;
  promoFreeQuantity: number | null;
  leaders: CampaignLeader[];
}

export default function PromoShareButton(props: PromoShareButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target flex items-center justify-center gap-2 rounded-xl bg-terracota py-3 text-center font-semibold uppercase tracking-wide text-off-white hover:bg-terracota/90"
      >
        <span aria-hidden>📢</span> Divulgar campanha
      </button>
      {open && <PromoPreview {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function PromoPreview({
  campaignName,
  priceCents,
  drawDate,
  prizes,
  promoBuyQuantity,
  promoFreeQuantity,
  leaders,
  onClose,
}: PromoShareButtonProps & { onClose: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "generating" | "error">("idle");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [templateIndex, setTemplateIndex] = useState(() =>
    Math.floor(Math.random() * PROMO_TEMPLATES.length)
  );

  const templateCtx = useMemo(
    () => ({ campaignName, priceCents, drawDate, prizes, promoBuyQuantity, promoFreeQuantity, leaders }),
    [campaignName, priceCents, drawDate, prizes, promoBuyQuantity, promoFreeQuantity, leaders]
  );
  const shareText = pickPromoTemplate(templateCtx, templateIndex);
  const headline = pickPosterHeadline(templateCtx, templateIndex);

  function handleNextTemplate() {
    setTemplateIndex((i) => (i + 1) % PROMO_TEMPLATES.length);
    setCopyState("idle");
  }

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewUrl(null);
    generatePromoImage({
      campaignName,
      priceCents,
      drawDate,
      prizes,
      promoBuyQuantity,
      promoFreeQuantity,
      leaders,
      headline,
    })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [campaignName, priceCents, drawDate, prizes, promoBuyQuantity, promoFreeQuantity, leaders, headline]);

  async function handleShare() {
    setState("generating");
    try {
      const blob = await generatePromoImage({
        campaignName,
        priceCents,
        drawDate,
        prizes,
        promoBuyQuantity,
        promoFreeQuantity,
        leaders,
        headline,
      });
      const fileName = `${campaignName.replace(/\s+/g, "-").toLowerCase()}-divulgacao.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        setState("idle");
        try {
          await navigator.share({ files: [file], title: campaignName, text: shareText });
          return;
        } catch {
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareText);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-off-white p-5 md:rounded-2xl">
        <div className="overflow-hidden rounded-2xl bg-verde-profundo shadow-lg">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Divulgação da campanha" className="block w-full" />
          ) : (
            <div className="flex aspect-[4/5] w-full items-center justify-center">
              <p className="text-sm text-creme/70">Gerando imagem...</p>
            </div>
          )}
        </div>

        <div className="mt-4 max-h-40 overflow-y-auto whitespace-pre-line rounded-xl bg-creme p-3 text-xs text-verde-profundo">
          {shareText}
        </div>

        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={handleNextTemplate}
            className="tap-target w-full rounded-xl border-2 border-verde-oliva/30 py-3 font-semibold uppercase tracking-wide text-verde-oliva hover:bg-creme/60"
          >
            <span aria-hidden>🔀</span> Ver outra sugestão
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={state === "generating"}
            className="tap-target w-full rounded-xl bg-terracota py-3 font-semibold uppercase tracking-wide text-off-white hover:bg-terracota/90 disabled:opacity-60"
          >
            {state === "generating" ? "Gerando..." : "Compartilhar imagem"}
          </button>
          {state === "error" && (
            <p className="text-center text-sm font-medium text-terracota">
              Não foi possível gerar a imagem. Tente novamente.
            </p>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="tap-target w-full rounded-xl bg-creme py-3 font-semibold uppercase tracking-wide text-verde-profundo hover:bg-creme/70"
          >
            {copyState === "copied" ? "Texto copiado ✓" : "Copiar texto do convite"}
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
