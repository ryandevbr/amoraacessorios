import { createFileRoute } from "@tanstack/react-router";
import { AdminPanel } from "@/components/admin-panel";
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administrar loja | Amora Acessórios" },
      {
        name: "description",
        content: "Produtos, banners, cupons e perfil da Amora Acessórios.",
      },
      { property: "og:title", content: "Administrar Amora Acessórios" },
      { property: "og:description", content: "Painel de gestão da Amora Acessórios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPanel,
});
