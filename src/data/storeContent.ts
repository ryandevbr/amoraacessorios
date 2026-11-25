import { money } from "@/data/catalog";

export const PROMO_ANNOUNCEMENT_DEFAULT_TEXT =
  "✨ Ganhe uma Consultoria de Automaquiagem nas compras a partir de R$ 150 (ou R$ 100 cada com uma amiga)!";

export const PROMO_WHATSAPP_QUESTION =
  "Olá, Amora Acessórios! Vi no site a campanha da Consultoria de Automaquiagem e gostaria de saber mais ✨";

export const PROMO_FRIEND_THRESHOLD = 100;
export const PROMO_INDIVIDUAL_THRESHOLD = 150;

export interface PromoCampaignStatus {
  tier: "below" | "friend" | "individual";
  progressPercent: number;
  cartMessage: string;
  checkoutLine: string | null;
}

export function getConsultoriaCampaignStatus(amountAfterDiscount: number): PromoCampaignStatus {
  const safeAmount = Math.max(0, Number.isFinite(amountAfterDiscount) ? amountAfterDiscount : 0);
  const progressPercent = Math.min(100, Math.round((safeAmount / PROMO_INDIVIDUAL_THRESHOLD) * 100));

  if (safeAmount >= PROMO_INDIVIDUAL_THRESHOLD) {
    return {
      tier: "individual",
      progressPercent: 100,
      cartMessage: "🎉 Parabéns! Você desbloqueou 1 Consultoria de Automaquiagem gratuita!",
      checkoutLine: "🎁 Brinde desbloqueado: Consultoria de Automaquiagem (Compra R$ 150+)",
    };
  }

  if (safeAmount >= PROMO_FRIEND_THRESHOLD) {
    const remainingForIndividual = Math.max(0, PROMO_INDIVIDUAL_THRESHOLD - safeAmount);
    return {
      tier: "friend",
      progressPercent,
      cartMessage: `✨ Você já garantiu a Consultoria vindo com uma amiga (R$ 100+)! Adicione mais ${money(remainingForIndividual)} para garantir também na compra individual.`,
      checkoutLine:
        "🎁 Elegível ao brinde: Consultoria de Automaquiagem (Promoção Amiga R$ 100+ cada)",
    };
  }

  const remainingForFriend = Math.max(0, PROMO_FRIEND_THRESHOLD - safeAmount);
  const remainingForIndividual = Math.max(0, PROMO_INDIVIDUAL_THRESHOLD - safeAmount);
  return {
    tier: "below",
    progressPercent,
    cartMessage: `Faltam ${money(remainingForFriend)} para você ganhar a Consultoria vindo com uma amiga (ou ${money(remainingForIndividual)} na compra individual)!`,
    checkoutLine: null,
  };
}

export const storeContent = {
  name: "Amora Acessórios",
  subtitle: "Semijoias, Bolsas & Maquiagens",
  instagramHandle: "@amoraacessoriosluxo",
  instagram: "https://instagram.com/amoraacessoriosluxo",
  whatsapp: "https://wa.me/5531988813158",
  whatsappDisplay: "(31) 98881-3158",
  address: "Rua 68, Nº 22 — Olaria, Timóteo - MG",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+68+22+Olaria+Timoteo+MG",
  slogan: "Realce sua beleza em cada detalhe: semijoias, bolsas & makes.",
  about:
    "Na Amora Acessórios, acreditamos que cada detalhe tem o poder de iluminar quem você é. Nossa curadoria reúne semijoias elegantes, bolsas para venda e aluguel para ocasiões especiais e maquiagens a partir de R$ 10 — unindo sofisticação, cuidado e acessibilidade. Recebemos você com carinho na nossa loja física no bairro Olaria, em Timóteo - MG, além de atendimento personalizado pelo WhatsApp com entrega em Timóteo e região.",
};
