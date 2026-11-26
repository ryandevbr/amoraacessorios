import { createFileRoute } from "@tanstack/react-router";
import { Storefront } from "@/components/storefront";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Amora Acessórios | Semijoias, Bolsas & Maquiagens — Timóteo" },
      {
        name: "description",
        content:
          "Semijoias, venda e aluguel de bolsas e maquiagens a partir de R$ 10. Retire na loja física na Rua 68, Nº 22 — Olaria, Timóteo - MG ou peça pelo WhatsApp (31) 98881-3158.",
      },
      {
        property: "og:title",
        content: "Amora Acessórios | Semijoias, Bolsas & Maquiagens — Timóteo",
      },
      {
        property: "og:description",
        content:
          "Semijoias, venda e aluguel de bolsas e maquiagens a partir de R$ 10. Loja física na Rua 68, Nº 22 — Olaria, Timóteo - MG.",
      },
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Amora Acessórios — Semijoias, Bolsas & Maquiagens" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "Amora Acessórios" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Amora Acessórios | Semijoias, Bolsas & Maquiagens — Timóteo",
      },
      {
        name: "twitter:description",
        content:
          "Semijoias, venda e aluguel de bolsas e maquiagens a partir de R$ 10. Rua 68, Nº 22 — Olaria, Timóteo - MG.",
      },
      { name: "twitter:image", content: "/og-image.png" },
    ],
  }),
  component: Storefront,
});
