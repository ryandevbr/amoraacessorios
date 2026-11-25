import { describe, expect, it } from "vitest";
import { getConsultoriaCampaignStatus } from "@/data/storeContent";

describe("Consultoria de Automaquiagem campaign status", () => {
  it("shows remaining amounts for friend (R$ 100) and individual (R$ 150) when subtotal < 100", () => {
    const status = getConsultoriaCampaignStatus(60);

    expect(status.tier).toBe("below");
    expect(status.progressPercent).toBe(40);
    expect(status.cartMessage).toContain("40,00");
    expect(status.cartMessage).toContain("90,00");
    expect(status.cartMessage).toContain("vindo com uma amiga");
    expect(status.cartMessage).toContain("compra individual");
    expect(status.checkoutLine).toBeNull();
  });

  it("unlocks friend tier and shows remaining for individual when 100 <= subtotal < 150", () => {
    const status = getConsultoriaCampaignStatus(120);

    expect(status.tier).toBe("friend");
    expect(status.progressPercent).toBe(80);
    expect(status.cartMessage).toContain("Consultoria vindo com uma amiga (R$ 100+)");
    expect(status.cartMessage).toContain("30,00");
    expect(status.checkoutLine).toBe(
      "🎁 Elegível ao brinde: Consultoria de Automaquiagem (Promoção Amiga R$ 100+ cada)",
    );
  });

  it("unlocks full individual tier when subtotal >= 150", () => {
    const atThreshold = getConsultoriaCampaignStatus(150);
    const aboveThreshold = getConsultoriaCampaignStatus(245.5);

    expect(atThreshold.tier).toBe("individual");
    expect(atThreshold.progressPercent).toBe(100);
    expect(atThreshold.cartMessage).toBe(
      "🎉 Parabéns! Você desbloqueou 1 Consultoria de Automaquiagem gratuita!",
    );
    expect(atThreshold.checkoutLine).toBe(
      "🎁 Brinde desbloqueado: Consultoria de Automaquiagem (Compra R$ 150+)",
    );
    expect(aboveThreshold.tier).toBe("individual");
    expect(aboveThreshold.progressPercent).toBe(100);
  });
});
