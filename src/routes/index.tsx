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
          "Realce sua beleza em cada detalhe: semijoias, bolsas para venda e aluguel e maquiagens a partir de R$ 10. Atendimento personalizado no Olaria, Timóteo - MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Storefront,
});
