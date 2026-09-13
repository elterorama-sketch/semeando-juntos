import { formatCentsBRL, formatDate, formatNumber } from "@/lib/format";

export interface ReceiptImageData {
  status: "paid" | "reserved";
  campaignName: string;
  customerName: string;
  numbers: number[];
  totalCents: number;
  changeCents?: number | null;
  drawDate: string | null;
}

const COLORS = {
  verdeProfundo: "#1F3D2B",
  verdeProfundoEscuro: "#12251A",
  verdeOliva: "#5C6B3B",
  creme: "#F3ECDD",
  offWhite: "#FBF9F3",
  terracota: "#B5623A",
  emerald: "#0F9D63",
  amber: "#F2B233",
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
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

export async function generateReceiptImage(data: ReceiptImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado neste dispositivo.");

  const isPaid = data.status === "paid";
  const accent = isPaid ? COLORS.emerald : COLORS.amber;
  const accentText = isPaid ? COLORS.offWhite : COLORS.verdeProfundo;

  // Background gradient, inspired by the campaign poster.
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, COLORS.verdeProfundo);
  bg.addColorStop(1, COLORS.verdeProfundoEscuro);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Decorative terracota circles, low opacity, poster-style.
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

  // Header
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(243,236,221,0.65)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("SEMEANDO JUNTOS", WIDTH / 2, 100);

  ctx.fillStyle = COLORS.creme;
  ctx.font = "800 48px system-ui, sans-serif";
  const campaignLines = wrapText(ctx, data.campaignName.toUpperCase(), WIDTH - 160);
  let y = 170;
  for (const line of campaignLines) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 56;
  }

  // Divider
  y += 18;
  ctx.strokeStyle = COLORS.terracota;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 90, y);
  ctx.lineTo(WIDTH / 2 + 90, y);
  ctx.stroke();

  // Status badge
  y += 60;
  const badgeLabel = isPaid ? "PAGAMENTO CONFIRMADO" : "AGUARDANDO PAGAMENTO";
  const badgeIcon = isPaid ? "✓" : "⏳";
  ctx.font = "700 34px system-ui, sans-serif";
  const badgeTextWidth = ctx.measureText(`${badgeIcon}  ${badgeLabel}`).width;
  const badgeW = badgeTextWidth + 90;
  const badgeH = 76;
  ctx.fillStyle = accent;
  roundedRect(ctx, WIDTH / 2 - badgeW / 2, y, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.fillStyle = accentText;
  ctx.textBaseline = "middle";
  ctx.fillText(`${badgeIcon}  ${badgeLabel}`, WIDTH / 2, y + badgeH / 2 + 2);
  ctx.textBaseline = "alphabetic";
  y += badgeH + 50;

  // Content card
  const cardX = 70;
  const cardW = WIDTH - 140;
  const cardY = y;
  const cardH = HEIGHT - cardY - 130;
  ctx.fillStyle = COLORS.offWhite;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fill();

  let cy = cardY + 70;
  const centerX = WIDTH / 2;

  ctx.fillStyle = COLORS.verdeOliva;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("COMPRADOR", centerX, cy);
  cy += 46;
  ctx.fillStyle = COLORS.verdeProfundo;
  ctx.font = "700 40px system-ui, sans-serif";
  const nameLines = wrapText(ctx, data.customerName, cardW - 80);
  for (const line of nameLines) {
    ctx.fillText(line, centerX, cy);
    cy += 48;
  }

  cy += 30;
  ctx.fillStyle = COLORS.verdeOliva;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("NÚMEROS", centerX, cy);
  cy += 50;
  ctx.fillStyle = COLORS.terracota;
  ctx.font = "800 46px system-ui, sans-serif";
  const numbersText = data.numbers.map((n) => formatNumber(n)).join("  •  ");
  const numberLines = wrapText(ctx, numbersText, cardW - 60);
  for (const line of numberLines) {
    ctx.fillText(line, centerX, cy);
    cy += 56;
  }

  cy += 34;
  ctx.strokeStyle = "rgba(92,107,59,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 50, cy);
  ctx.lineTo(cardX + cardW - 50, cy);
  ctx.stroke();
  cy += 60;

  ctx.fillStyle = COLORS.verdeOliva;
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("VALOR TOTAL", centerX, cy);
  cy += 56;
  ctx.fillStyle = COLORS.verdeProfundo;
  ctx.font = "800 56px system-ui, sans-serif";
  ctx.fillText(formatCentsBRL(data.totalCents), centerX, cy);

  if (isPaid && data.changeCents != null && data.changeCents > 0) {
    cy += 44;
    ctx.fillStyle = COLORS.verdeOliva;
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText(`Troco: ${formatCentsBRL(data.changeCents)}`, centerX, cy);
  }

  if (data.drawDate) {
    cy += 54;
    ctx.fillStyle = COLORS.verdeOliva;
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText(`Sorteio em ${formatDate(data.drawDate)}`, centerX, cy);
  }

  // Footer
  ctx.fillStyle = "rgba(243,236,221,0.75)";
  ctx.font = "italic 500 28px system-ui, sans-serif";
  const footer = isPaid
    ? "Obrigado por participar!"
    : "Confirme o pagamento assim que possível.";
  ctx.fillText(footer, centerX, HEIGHT - 60);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Falha ao gerar imagem."));
    }, "image/png");
  });
}
