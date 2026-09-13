import { formatCentsBRL, formatDate } from "@/lib/format";

export interface PromoImageData {
  campaignName: string;
  priceCents: number;
  drawDate: string | null;
  prizes: { position: number; title: string }[];
  promoBuyQuantity: number | null;
  promoFreeQuantity: number | null;
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
const HEIGHT = 1350;

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
// public self-checkout in this app by design (assisted-sale model).
export async function generatePromoImage(data: PromoImageData): Promise<Blob> {
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
  const nameLines = wrapText(ctx, data.campaignName.toUpperCase(), WIDTH - 140);
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
  ctx.font = "700 40px system-ui, sans-serif";
  const hasPromo = data.promoBuyQuantity && data.promoFreeQuantity;
  ctx.fillText(
    hasPromo
      ? `Compre ${data.promoBuyQuantity} ganhe ${data.promoFreeQuantity}!`
      : "Ajude e concorra a prêmios!",
    centerX,
    y
  );
  y += 60;

  ctx.fillStyle = COLORS.offWhite;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(`Número por ${formatCentsBRL(data.priceCents)}`, centerX, y);
  y += 60;

  // Prizes card
  const cardX = 80;
  const cardW = WIDTH - 160;
  const prizeLines = data.prizes.slice(0, 4);
  const cardH = 90 + prizeLines.length * 64 + (data.drawDate ? 70 : 20);
  ctx.fillStyle = COLORS.offWhite;
  roundedRect(ctx, cardX, y, cardW, cardH, 28);
  ctx.fill();

  let cy = y + 60;
  ctx.fillStyle = COLORS.verdeOliva;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("PRÊMIOS", centerX, cy);
  cy += 46;

  ctx.font = "700 32px system-ui, sans-serif";
  prizeLines.forEach((p) => {
    ctx.fillStyle = COLORS.terracota;
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

  y += cardH + 60;

  // Call to action
  ctx.fillStyle = COLORS.terracota;
  roundedRect(ctx, cardX, y, cardW, 130, 24);
  ctx.fill();
  ctx.fillStyle = COLORS.offWhite;
  ctx.font = "700 32px system-ui, sans-serif";
  const cta1 = wrapText(ctx, "Procure um cooperador da sua congregação", cardW - 60);
  const cta2 = "e garanta já seus números pelo WhatsApp!";
  let ctaY = y + 44;
  cta1.forEach((line) => {
    ctx.fillText(line, centerX, ctaY);
    ctaY += 38;
  });
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText(cta2, centerX, ctaY);

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
