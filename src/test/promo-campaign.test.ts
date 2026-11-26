import { describe, expect, it } from "vitest";
import { DEFAULT_STORE_PROMOTION, initialData, shouldShowPromotion } from "@/data/catalog";

describe("Dynamic store promotions settings", () => {
  it("seeds default Consultoria de Automaquiagem promotion fields", () => {
    expect(initialData.announcement.promo_active).toBe(true);
    expect(initialData.announcement.promo_badge).toBe("CAMPANHA ESPECIAL DA SEMANA");
    expect(initialData.announcement.promo_title).toBe("Ganhe uma Consultoria de Automaquiagem!");
    expect(initialData.announcement.promo_description).toContain("R$ 150");
    expect(initialData.announcement.promo_description).toContain("R$ 100");
    expect(initialData.announcement.promo_highlight).toBe("Válido por tempo limitado");
    expect(initialData.announcement.promo_cta_label).toBe("");
    expect(initialData.announcement.promo_cta_type).toBe("vitrine");
  });

  it("shows promotion section only when promo_active is true and promo_title is non-empty", () => {
    expect(shouldShowPromotion(DEFAULT_STORE_PROMOTION)).toBe(true);
    expect(
      shouldShowPromotion({ promo_active: false, promo_title: "Semana do Brilho" }),
    ).toBe(false);
    expect(shouldShowPromotion({ promo_active: true, promo_title: "   " })).toBe(false);
    expect(shouldShowPromotion({ promo_active: true, promo_title: "" })).toBe(false);
  });
});
