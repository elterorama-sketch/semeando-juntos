import { formatCentsBRL, formatDate } from "@/lib/format";
import { formatPhoneBR, type CampaignLeader } from "@/lib/campaignLeaders";
import { VAROES_CONGRESS } from "@/lib/varoesCongress";

export interface PromoImageData {
  campaignName: string;
  priceCents: number;
  drawDate: string | null;
  prizes: { position: number; title: string }[];
  promoBuyQuantity: number | null;
  promoFreeQuantity: number | null;
  leaders: CampaignLeader[];
  // Overrides the CTA headline ("Colabore e concorra a prêmios!" etc.) --
  // lets the poster match whichever text sugestão is currently selected.
  headline?: string | null;
}

const COLORS = {
  verdeProfundo: "#1F3D2B",
  verdeProfundoEscuro: "#12251A",
  verdeOliva: "#5C6B3B",
  creme: "#F3ECDD",
  offWhite: "#FBF9F3",
  terracota: "#B5623A",
};

const WIDTH = 1080;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// A poster-style invite image -- shareable in WhatsApp groups/status to get
// church members buying numbers *through a cooperador*, since there's no
// public self-checkout in this app by design (assisted-sale model). Ends
// with a named list of leaders + WhatsApp numbers to drive direct contact.
export async function generatePromoImage(data: PromoImageData): Promise<Blob> {
  const leaders = data.leaders;
  const leaderRows = Math.max(1, Math.ceil(leaders.length / 2));
  const LEADERS_CARD_H = leaders.length > 0 ? 90 + leaderRows * 66 + 20 : 130;
  const prizeLines = data.prizes.slice(0, 4);
  const PRIZES_CARD_H = 90 + prizeLines.length * 64 + (data.drawDate ? 70 : 20);
  const cardW = WIDTH - 160;
  const hasPromo = data.promoBuyQuantity && data.promoFreeQuantity;
  const headlineText =
    data.headline ??
    (hasPromo
      ? `Compre ${data.promoBuyQuantity} ganhe ${data.promoFreeQuantity}!`
      : "Colabore e concorra a prêmios!");

  // Measuring pass: text metrics need a 2D context, but the canvas height
  // depends on how many lines that text wraps into -- so measure on a
  // throwaway canvas before sizing the real one.
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = WIDTH;
  measureCanvas.height = 10;
  const mctx = measureCanvas.getContext("2d");
  if (!mctx) throw new Error("Canvas não suportado neste dispositivo.");

  mctx.font = "800 54px system-ui, sans-serif";
  const nameLines = wrapText(mctx, data.campaignName.toUpperCase(), WIDTH - 140);

  mctx.font = "800 34px system-ui, sans-serif";
  const headlineLines = wrapText(mctx, headlineText, WIDTH - 200);

  mctx.font = "800 28px system-ui, sans-serif";
  const congressTitleLines = wrapText(mctx, VAROES_CONGRESS.title, cardW - 80);

  const NAME_H = nameLines.length * 60;
  const HEADLINE_H = 60 + Math.max(0, headlineLines.length - 1) * 46;
  const CONGRESS_CARD_H = 128 + congressTitleLines.length * 34;

  const HEIGHT =
    100 +
    60 +
    NAME_H +
    20 +
    4 +
    50 +
    HEADLINE_H +
    60 +
    PRIZES_CARD_H +
    60 +
    44 +
    LEADERS_CARD_H +
    50 +
    CONGRESS_CARD_H +
    130;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado neste dispositivo.");

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, COLORS.verdeProfundo);
  bg.addColorStop(1, COLORS.verdeProfundoEscuro);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = COLORS.terracota;
  ctx.beginPath();
  ctx.arc(WIDTH - 60, 100, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, HEIGHT - 120, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = "center";
  const centerX = WIDTH / 2;
  let y = 100;

  ctx.fillStyle = "rgba(243,236,221,0.65)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("CAMPANHA", centerX, y);
  y += 60;

  ctx.fillStyle = COLORS.creme;
  ctx.font = "800 54px system-ui, sans-serif";
  for (const line of nameLines) {
    ctx.fillText(line, centerX, y);
    y += 60;
  }

  y += 20;
  ctx.strokeStyle = COLORS.terracota;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(centerX - 90, y);
  ctx.lineTo(centerX + 90, y);
  ctx.stroke();
  y += 50;

  ctx.fillStyle = COLORS.terracota;
  ctx.font = "800 34px system-ui, sans-serif";
  headlineLines.forEach((line, i) => {
    ctx.fillText(line, centerX, y + i * 46);
  });
  y += HEADLINE_H;

  ctx.fillStyle = COLORS.offWhite;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(`Número por ${formatCentsBRL(data.priceCents)}`, centerX, y);
  y += 60;

  // Prizes card
  const cardX = 80;
  ctx.fillStyle = COLORS.offWhite;
  roundedRect(ctx, cardX, y, cardW, PRIZES_CARD_H, 28);
  ctx.fill();

  let cy = y + 60;
  ctx.fillStyle = COLORS.verdeOliva;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("PRÊMIOS", centerX, cy);
  cy += 46;

  ctx.font = "700 32px system-ui, sans-serif";
  prizeLines.forEach((p) => {
    const ordinal = `${p.position}º`;
    const text = `${ordinal} — ${p.title}`;
    const lines = wrapText(ctx, text, cardW - 80);
    lines.forEach((line) => {
      ctx.fillStyle = COLORS.verdeProfundo;
      ctx.fillText(line, centerX, cy);
      cy += 40;
    });
    cy += 4;
  });

  if (data.drawDate) {
    cy += 10;
    ctx.fillStyle = COLORS.verdeOliva;
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText(`Sorteio em ${formatDate(data.drawDate)}`, centerX, cy);
  }

  y += PRIZES_CARD_H + 60;

  // Call to action headline
  ctx.fillStyle = COLORS.terracota;
  ctx.font = "800 34px system-ui, sans-serif";
  ctx.fillText(
    leaders.length > 0 ? "📲 COMPRE OU RESERVE PELO WHATSAPP" : "📲 GARANTA JÁ SEUS NÚMEROS",
    centerX,
    y
  );
  y += 44;

  ctx.fillStyle = COLORS.offWhite;
  roundedRect(ctx, cardX, y, cardW, LEADERS_CARD_H, 28);
  ctx.fill();

  if (leaders.length > 0) {
    // Leaders card: name + WhatsApp number, two columns
    let ly = y + 56;
    ctx.fillStyle = COLORS.verdeOliva;
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.fillText("FALE COM UM COOPERADOR", centerX, ly);
    ly += 44;

    const colW = (cardW - 60) / 2;
    const col1X = cardX + 30 + colW / 2;
    const col2X = cardX + 30 + colW + colW / 2;
    const rowH = 66;
    leaders.forEach((leader, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? col1X : col2X;
      const rowY = ly + row * rowH;

      ctx.font = "700 30px system-ui, sans-serif";
      ctx.fillStyle = COLORS.verdeProfundo;
      ctx.fillText(leader.name, x, rowY);

      ctx.font = "600 26px system-ui, sans-serif";
      ctx.fillStyle = COLORS.terracota;
      ctx.fillText(`📱 ${formatPhoneBR(leader.phone)}`, x, rowY + 32);
    });
  } else {
    ctx.fillStyle = COLORS.verdeProfundo;
    ctx.font = "700 30px system-ui, sans-serif";
    const cta1 = wrapText(ctx, "Procure um cooperador da sua congregação", cardW - 60);
    let ctaY = y + 54;
    cta1.forEach((line) => {
      ctx.fillText(line, centerX, ctaY);
      ctaY += 38;
    });
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillText("e garanta já seus números!", centerX, ctaY);
  }

  y += LEADERS_CARD_H + 50;

  // Congress info card
  ctx.fillStyle = "rgba(243,236,221,0.12)";
  roundedRect(ctx, cardX, y, cardW, CONGRESS_CARD_H, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(181,98,58,0.5)";
  ctx.lineWidth = 2;
  roundedRect(ctx, cardX, y, cardW, CONGRESS_CARD_H, 24);
  ctx.stroke();

  let congY = y + 42;
  ctx.fillStyle = COLORS.creme;
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillText("⛪ Colabore com o:", centerX, congY);
  congY += 36;

  ctx.fillStyle = COLORS.offWhite;
  ctx.font = "800 28px system-ui, sans-serif";
  congressTitleLines.forEach((line) => {
    ctx.fillText(line, centerX, congY);
    congY += 34;
  });

  ctx.fillStyle = "rgba(243,236,221,0.85)";
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText(VAROES_CONGRESS.dates, centerX, congY);

  ctx.fillStyle = "rgba(243,236,221,0.6)";
  ctx.font = "italic 500 26px system-ui, sans-serif";
  ctx.fillText("🌱 Semeando Juntos 🌱", centerX, HEIGHT - 50);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Falha ao gerar imagem."));
    }, "image/png");
  });
}
