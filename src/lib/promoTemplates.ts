import { formatCentsBRL, formatDate } from "@/lib/format";
import { formatPhoneBR, waLink, type CampaignLeader } from "@/lib/campaignLeaders";
import { VAROES_CONGRESS } from "@/lib/varoesCongress";

export interface PromoTemplateContext {
  campaignName: string;
  priceCents: number;
  drawDate: string | null;
  prizes: { position: number; title: string }[];
  promoBuyQuantity: number | null;
  promoFreeQuantity: number | null;
  leaders: CampaignLeader[];
}

function promoLine(ctx: PromoTemplateContext): string | null {
  return ctx.promoBuyQuantity && ctx.promoFreeQuantity
    ? `Compre ${ctx.promoBuyQuantity} ganhe ${ctx.promoFreeQuantity}!`
    : null;
}

function prizesLines(ctx: PromoTemplateContext): string[] {
  return ctx.prizes.slice(0, 4).map((p) => `🎁 ${p.position}º prêmio: ${p.title}`);
}

function drawLine(ctx: PromoTemplateContext): string | null {
  return ctx.drawDate ? `📅 Sorteio: ${formatDate(ctx.drawDate)}` : null;
}

function congressBlock(): string[] {
  return [
    `⛪ ${VAROES_CONGRESS.title}`,
    `🗓️ ${VAROES_CONGRESS.dates} — 📍 ${VAROES_CONGRESS.location}`,
    `Tema: "${VAROES_CONGRESS.theme}"`,
  ];
}

function leadersBlock(ctx: PromoTemplateContext, intro: string): string[] {
  if (ctx.leaders.length === 0) {
    return ["👉 Procure um cooperador da sua congregação e garanta já seus números!"];
  }
  return [intro, ...ctx.leaders.map((l) => `• ${l.name} — ${formatPhoneBR(l.phone)} — ${waLink(l.phone)}`)];
}

function join(lines: (string | null)[]): string {
  return lines.filter((l): l is string => l !== null).join("\n");
}

export const PROMO_TEMPLATES: ((ctx: PromoTemplateContext) => string)[] = [
  // 1. Direto ao ponto
  (ctx) =>
    join([
      `🌱 CAMPANHA ${ctx.campaignName.toUpperCase()} 🌱`,
      `Número por ${formatCentsBRL(ctx.priceCents)}` + (promoLine(ctx) ? ` — ${promoLine(ctx)}` : ""),
      "",
      ...prizesLines(ctx),
      drawLine(ctx),
      "",
      "Toda a arrecadação desta campanha é para o:",
      ...congressBlock(),
      "",
      ...leadersBlock(ctx, "📲 Compre ou reserve seu número direto pelo WhatsApp:"),
    ]),

  // 2. Urgência
  (ctx) =>
    join([
      "⏰ Os números estão acabando!",
      `Campanha ${ctx.campaignName} — só ${formatCentsBRL(ctx.priceCents)} cada` +
        (promoLine(ctx) ? `, ${promoLine(ctx)}` : "."),
      ...prizesLines(ctx).slice(0, 2),
      "",
      "Toda a renda desta campanha é para o:",
      ...congressBlock(),
      "",
      "Chama um cooperador no WhatsApp agora e não fica de fora! 🙏",
      ...leadersBlock(ctx, "📲 Fale com:"),
    ]),

  // 3. Apelo de fé/comunidade
  (ctx) =>
    join([
      "Juntos somos mais fortes! 🌱",
      `A campanha ${ctx.campaignName} ajuda a igreja e ainda te dá a chance de concorrer a prêmios.`,
      "Cada número é uma semente — e a colheita é toda para o:",
      ...congressBlock(),
      VAROES_CONGRESS.verse,
      "",
      ...leadersBlock(ctx, "📲 Procure um cooperador e adquira o seu:"),
    ]),

  // 4. Foco na promoção
  (ctx) =>
    join([
      promoLine(ctx) ? `💰 ${promoLine(ctx)}` : "💰 Garanta já o seu número!",
      `Campanha ${ctx.campaignName} — apenas ${formatCentsBRL(ctx.priceCents)} o número.`,
      ...prizesLines(ctx),
      drawLine(ctx),
      "",
      `E o melhor: a arrecadação é toda para o ${VAROES_CONGRESS.title.split("—")[0].trim()}`,
      `(${VAROES_CONGRESS.dates}, ${VAROES_CONGRESS.location.split("—")[1]?.trim() ?? VAROES_CONGRESS.location}).`,
      "",
      ...leadersBlock(ctx, "📲 Garanta os seus com um cooperador:"),
    ]),

  // 5. Pergunta / engajamento
  (ctx) =>
    join([
      `Já pegou o seu número da campanha ${ctx.campaignName}? 👀`,
      `${formatCentsBRL(ctx.priceCents)} cada` + (promoLine(ctx) ? `, ${promoLine(ctx)}` : "."),
      ...prizesLines(ctx).slice(0, 2),
      "",
      `A arrecadação desta campanha é para o ${VAROES_CONGRESS.title.split("—")[0].trim()}, dias ${VAROES_CONGRESS.dates}.`,
      "",
      ...leadersBlock(ctx, "Fala com um cooperador e participa também! 📲"),
    ]),

  // 6. Contagem regressiva
  (ctx) =>
    join([
      drawLine(ctx) ? `📅 Faltam poucas semanas para o sorteio da ${ctx.campaignName}!` : `📅 Campanha ${ctx.campaignName} em andamento!`,
      ...prizesLines(ctx),
      `Número por ${formatCentsBRL(ctx.priceCents)}` + (promoLine(ctx) ? `, ${promoLine(ctx)}` : "."),
      "",
      `Não perde essa — a arrecadação é para o ${VAROES_CONGRESS.title.split("—")[0].trim()} (${VAROES_CONGRESS.dates}).`,
      "",
      ...leadersBlock(ctx, "Fala com um cooperador pelo WhatsApp hoje mesmo! 📲"),
    ]),

  // 7. Foco em ajudar a igreja/campo
  (ctx) =>
    join([
      "Cada número comprado ajuda a nossa igreja a crescer. 🙌",
      `Campanha ${ctx.campaignName}: ${formatCentsBRL(ctx.priceCents)} o número` +
        (promoLine(ctx) ? `, ${promoLine(ctx)}` : "."),
      ...prizesLines(ctx).slice(0, 2),
      "",
      `A renda desta campanha é toda para o ${VAROES_CONGRESS.title.split("—")[0].trim()}`,
      `— tema "${VAROES_CONGRESS.theme}", ${VAROES_CONGRESS.dates}.`,
      "",
      ...leadersBlock(ctx, "👉 Procure um cooperador e faça parte dessa semeadura:"),
    ]),

  // 8. Curto para status do WhatsApp
  (ctx) =>
    join([
      `🌱 ${ctx.campaignName}`,
      `${formatCentsBRL(ctx.priceCents)} o número` + (promoLine(ctx) ? ` | ${promoLine(ctx)}` : ""),
      ctx.prizes.length > 0 ? `${ctx.prizes.length} prêmio(s) em jogo 🎁` : null,
      `Arrecadação para o Congresso de Varões (${VAROES_CONGRESS.dates}) ⛪`,
      drawLine(ctx),
      "Chama um cooperador! 📲",
    ]),

  // 9. Foco nos prêmios
  (ctx) =>
    join([
      ctx.prizes.length > 0 ? `🎁 Prêmios em jogo na campanha ${ctx.campaignName}!` : `🎁 Participe da campanha ${ctx.campaignName}!`,
      ...prizesLines(ctx),
      `Número por ${formatCentsBRL(ctx.priceCents)}` + (promoLine(ctx) ? ` (${promoLine(ctx)})` : "."),
      drawLine(ctx),
      "",
      `E toda a arrecadação é para o ${VAROES_CONGRESS.title.split("—")[0].trim()}!`,
      "",
      ...leadersBlock(ctx, "Garanta o seu com um cooperador! 📲"),
    ]),

  // 10. Convite pessoal/caloroso
  (ctx) =>
    join([
      `Oi! Passando pra te convidar a participar da campanha ${ctx.campaignName}. 🌱`,
      `É simples: ${formatCentsBRL(ctx.priceCents)} por número` + (promoLine(ctx) ? `, ${promoLine(ctx)}` : "."),
      "Toda a arrecadação desta campanha é para o:",
      ...congressBlock(),
      "",
      ctx.leaders.length > 0
        ? `Se quiser, fala com um cooperador (${ctx.leaders.map((l) => l.name).join(", ")}) e já garante o seu!`
        : "Se quiser, fala com um cooperador da sua congregação e já garante o seu!",
    ]),
];

export function pickPromoTemplate(ctx: PromoTemplateContext, index: number): string {
  const i = ((index % PROMO_TEMPLATES.length) + PROMO_TEMPLATES.length) % PROMO_TEMPLATES.length;
  return PROMO_TEMPLATES[i](ctx);
}
