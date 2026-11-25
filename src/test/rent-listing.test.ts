import { describe, expect, it } from "vitest";
import {
  buildRentWhatsAppMessage,
  formatDateBr,
  initialData,
  isRentProduct,
  resolveListingType,
  type Product,
} from "@/data/catalog";

const baseProduct = initialData.products[0];
if (!baseProduct) throw new Error("Missing sample product");

describe("Rental listing helpers", () => {
  it("detects rental products via listing_type or legacy category/material fallback", () => {
    expect(isRentProduct({ listing_type: "rent", category: "Bolsas", material: "Bolsa" })).toBe(
      true,
    );
    expect(
      isRentProduct({ listing_type: "sale", category: "Aluguel de Bolsas", material: "Bolsa" }),
    ).toBe(true);
    expect(isRentProduct({ listing_type: "sale", category: "Bolsas", material: "Aluguel" })).toBe(
      true,
    );
    expect(isRentProduct({ listing_type: "sale", category: "Brincos", material: "Semijoia" })).toBe(
      false,
    );
    expect(resolveListingType(undefined, "Aluguel de Bolsas", "Bolsa")).toBe("rent");
    expect(resolveListingType("sale", "Brincos", "Semijoia")).toBe("sale");
  });

  it("formats ISO dates to Brazilian DD/MM/YYYY without timezone shift", () => {
    expect(formatDateBr("2026-12-19")).toBe("19/12/2026");
    expect(formatDateBr("2026-01-05")).toBe("05/01/2026");
  });

  it("builds the WhatsApp rental message with and without customer name", () => {
    const rentProduct: Product = {
      ...baseProduct,
      id: "clutch-1",
      name: "Clutch Dourada Festa",
      listing_type: "rent",
      price: 55.9,
      is_on_sale: false,
    };

    const withName = buildRentWhatsAppMessage({
      product: rentProduct,
      eventDateIso: "2026-12-19",
      customerName: "Mariana",
      productUrl: "https://amora.com.br/?produto=clutch-1",
    });

    expect(withName).toContain("Olá, Amora Acessórios! ✨");
    expect(withName).toContain("disponibilidade de *aluguel* da peça:");
    expect(withName).toContain("• *Clutch Dourada Festa* (R$\u00a055,90 / aluguel)");
    expect(withName).toContain("📅 Data do evento: 19/12/2026");
    expect(withName).toContain("👤 Nome: Mariana");
    expect(withName).toContain("🔗 Link da peça: https://amora.com.br/?produto=clutch-1");
    expect(withName).toContain("Aguardo a confirmação da disponibilidade!");

    const withoutName = buildRentWhatsAppMessage({
      product: rentProduct,
      eventDateIso: "2026-12-19",
      customerName: "   ",
      productUrl: "https://amora.com.br/?produto=clutch-1",
    });

    expect(withoutName).not.toContain("👤 Nome:");
  });
});
