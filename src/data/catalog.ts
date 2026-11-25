export type ProductListingType = "sale" | "rent";

export interface ProductCharacteristic {
  attribute: string;
  value: string;
}
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  material: string;
  listing_type: ProductListingType;
  price: number;
  sale_price: number;
  is_on_sale: boolean;
  sale_label: string;
  image_url: string;
  description: string;
  active: boolean;
  featured: boolean;
  in_stock: boolean;
  characteristics: ProductCharacteristic[];
}
export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order_value: number;
  expires_at: string;
  active: boolean;
  allow_on_sale: boolean;
}
export interface Banner {
  id: string;
  image_url: string;
  mobile_image_url?: string;
  alt: string;
  active: boolean;
  filter: string;
  display_order?: number;
}
export interface StoreAnnouncement {
  active: boolean;
  text: string;
  link: string;
  promo_campaign_active: boolean;
}
export interface AdminProfile {
  name: string;
  email: string;
  avatar: string;
}
export interface StoreData {
  products: Product[];
  coupons: Coupon[];
  banners: Banner[];
  announcement: StoreAnnouncement;
  profile: AdminProfile;
}
export const emptyStoreData: StoreData = {
  products: [],
  coupons: [],
  banners: [],
  announcement: { active: false, text: "", link: "#vitrine", promo_campaign_active: true },
  profile: { name: "Administradora", email: "", avatar: "" },
};

function makeEditorialPlaceholder(
  tag: string,
  title: string,
  variant: "plum" | "champagne" | "ivory" = "champagne",
  dimensions: { width: number; height: number } = { width: 800, height: 1000 },
): string {
  const bg = variant === "plum" ? "#4A192C" : variant === "ivory" ? "#FCF9F5" : "#F3ECE2";
  const accent = variant === "plum" ? "#D8BC94" : "#B88B58";
  const text = variant === "plum" ? "#FCF9F5" : "#24161B";
  const sub = variant === "plum" ? "#D8BC94" : "#69565C";
  const { width, height } = dimensions;
  const cx = width / 2;
  const cy = height / 2 - 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="${accent}" stroke-opacity="0.38" stroke-width="1.5"/>
    <g transform="translate(${cx - 36}, ${cy - 68})">
      <path d="M36 60L6 26L17 11L28 7.5L36 14L44 7.5L55 11L66 26L36 60Z" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M6 26H66M17 11L22.5 26L36 60L49.5 26L55 11M36 14L22.5 26M36 14L49.5 26" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linejoin="round"/>
    </g>
    <text x="${cx}" y="${cy + 36}" text-anchor="middle" font-family="Georgia, serif" font-size="24" letter-spacing="6" fill="${accent}">AMORA</text>
    <text x="${cx}" y="${cy + 70}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" letter-spacing="3" fill="${sub}">${tag.toUpperCase()}</text>
    <text x="${cx}" y="${cy + 106}" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="${text}">${title}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface DemoSeedItem {
  name: string;
  category: string;
  material: string;
  listing_type?: ProductListingType;
  price: number;
  is_on_sale?: boolean;
  featured?: boolean;
  in_stock?: boolean;
  description: string;
  variant: "plum" | "champagne" | "ivory";
  characteristics: ProductCharacteristic[];
}

const demoItems: DemoSeedItem[] = [
  {
    name: "Argola Cravejada Dourada",
    category: "Brincos",
    material: "Semijoia",
    price: 69.9,
    is_on_sale: true,
    featured: true,
    variant: "champagne",
    description:
      "Argola sofisticada com brilho delicado que ilumina qualquer produção. Perfeita para compor looks do dia a dia ou eventos especiais.",
    characteristics: [
      { attribute: "Acabamento", value: "Banho dourado polido" },
      { attribute: "Pedra", value: "Zircônias cravejadas" },
      { attribute: "Estilo", value: "Clássico atemporal" },
    ],
  },
  {
    name: "Clutch Festa Dourada Champanhe",
    category: "Aluguel de Bolsas",
    material: "Aluguel",
    listing_type: "rent",
    price: 59.9,
    featured: true,
    variant: "plum",
    description:
      "Clutch estruturada em tom champanhe perfeita para casamentos, formaturas e festas. Consulte disponibilidade de datas pelo WhatsApp.",
    characteristics: [
      { attribute: "Modalidade", value: "Aluguel para eventos" },
      { attribute: "Cor", value: "Dourado champanhe" },
      { attribute: "Alça", value: "Corrente removível" },
    ],
  },
  {
    name: "Gloss Labial Brilho Espelhado",
    category: "Maquiagens",
    material: "Maquiagem",
    price: 14.9,
    featured: true,
    variant: "ivory",
    description:
      "Textura confortável com brilho espelhado e toque hidratante para realçar os lábios em segundos. Ideal para levar sempre na bolsa.",
    characteristics: [
      { attribute: "Tipo", value: "Gloss labial" },
      { attribute: "Acabamento", value: "Espelhado luminoso" },
      { attribute: "Uso", value: "Dia a dia e eventos" },
    ],
  },
  {
    name: "Bolsa Tiracolo Estruturada Nude",
    category: "Bolsas",
    material: "Bolsa",
    price: 159.9,
    featured: true,
    variant: "champagne",
    description:
      "Design moderno e estruturado com ferragens douradas e ótimo espaço interno. Versátil para transitar do trabalho ao jantar com elegância.",
    characteristics: [
      { attribute: "Modelo", value: "Tiracolo estruturada" },
      { attribute: "Cor", value: "Nude champanhe" },
      { attribute: "Detalhes", value: "Ferragens douradas" },
    ],
  },
  {
    name: "Colar Ponto de Luz em Prata",
    category: "Colares",
    material: "Prata 925",
    price: 89.9,
    variant: "ivory",
    description:
      "Corrente delicada em Prata 925 com pingente ponto de luz que garante brilho sutil e feminino em todas as ocasiões.",
    characteristics: [
      { attribute: "Material", value: "Prata 925" },
      { attribute: "Acabamento", value: "Polido" },
      { attribute: "Estilo", value: "Minimalista delicado" },
    ],
  },
  {
    name: "Pulseira Riviera Dourada",
    category: "Pulseiras",
    material: "Semijoia",
    price: 129.9,
    is_on_sale: true,
    variant: "champagne",
    description:
      "Clássica pulseira riviera cravejada para elevar qualquer combinação de pulsos com sofisticação e brilho intenso.",
    characteristics: [
      { attribute: "Acabamento", value: "Banho dourado" },
      { attribute: "Pedra", value: "Zircônias cristal" },
      { attribute: "Ocasião", value: "Social e festa" },
    ],
  },
  {
    name: "Paleta de Sombras Tons Terrosos",
    category: "Maquiagens",
    material: "Maquiagem",
    price: 29.9,
    variant: "ivory",
    description:
      "Cores versáteis entre opacos aveludados e cintilantes dourados para criar desde makes suaves até esfumados marcantes.",
    characteristics: [
      { attribute: "Tipo", value: "Paleta de sombras" },
      { attribute: "Acabamento", value: "Matte e cintilante" },
      { attribute: "Paleta", value: "Tons neutros e dourados" },
    ],
  },
  {
    name: "Anel Solitário em Prata 925",
    category: "Anéis",
    material: "Prata 925",
    price: 94.9,
    variant: "champagne",
    description:
      "Anel solitário de linhas delicadas com zircônia central luminosa. Uma peça coringa para usar sozinha ou em mix de anéis.",
    characteristics: [
      { attribute: "Material", value: "Prata 925" },
      { attribute: "Pedra", value: "Zircônia solitária" },
      { attribute: "Estilo", value: "Romântico clássico" },
    ],
  },
  {
    name: "Clutch Pérolas Noiva & Festa",
    category: "Aluguel de Bolsas",
    material: "Aluguel",
    listing_type: "rent",
    price: 69.9,
    variant: "plum",
    description:
      "Peça sofisticada com acabamento perolado e fecho joia dourado, pensada para madrinhas, formandas e convidadas especiais.",
    characteristics: [
      { attribute: "Modalidade", value: "Aluguel para festas" },
      { attribute: "Acabamento", value: "Perolado com fecho dourado" },
      { attribute: "Ocasião", value: "Casamentos e gala" },
    ],
  },
  {
    name: "Anel Orgânico Banhado a Ouro",
    category: "Anéis",
    material: "Semijoia",
    price: 74.9,
    in_stock: false,
    variant: "champagne",
    description:
      "Design autoral de curvas orgânicas e brilho espelhado para compor produções modernas e cheias de personalidade.",
    characteristics: [
      { attribute: "Acabamento", value: "Dourado espelhado" },
      { attribute: "Design", value: "Formas orgânicas" },
      { attribute: "Estilo", value: "Contemporâneo" },
    ],
  },
  {
    name: "Conjunto Pérola Clássico",
    category: "Conjuntos",
    material: "Semijoia",
    price: 189.9,
    is_on_sale: true,
    variant: "plum",
    description:
      "Colar e brincos harmonizados com pérolas delicadas e banho dourado impecável — escolha certeira para presentear ou brilhar em eventos.",
    characteristics: [
      { attribute: "Composição", value: "Colar + par de brincos" },
      { attribute: "Detalhe", value: "Pérolas clássicas" },
      { attribute: "Acabamento", value: "Banho dourado" },
    ],
  },
  {
    name: "Blush Compacto Aveludado",
    category: "Maquiagens",
    material: "Maquiagem",
    price: 10.0,
    variant: "ivory",
    description:
      "Textura fina e fácil de esfumar que devolve o ar saudável às maçãs do rosto com acabamento natural e longa duração.",
    characteristics: [
      { attribute: "Tipo", value: "Blush compacto" },
      { attribute: "Acabamento", value: "Aveludado natural" },
      { attribute: "Diferencial", value: "Linha make a partir de R$ 10" },
    ],
  },
];

export const initialData: StoreData = {
  products: demoItems.map((item, i) => ({
    id: `amora-${i + 1}`,
    name: item.name,
    sku: `AM${String(i + 1).padStart(3, "0")}`,
    category: item.category,
    material: item.material,
    listing_type: item.listing_type ?? "sale",
    price: item.price,
    sale_price: Number((item.price * 0.8).toFixed(2)),
    is_on_sale: Boolean(item.is_on_sale),
    sale_label: "",
    image_url: makeEditorialPlaceholder(item.category, item.name, item.variant),
    description: item.description,
    active: true,
    featured: Boolean(item.featured),
    in_stock: item.in_stock ?? true,
    characteristics: item.characteristics,
  })),
  coupons: [
    {
      id: "first",
      code: "PRIMEIRACOMPRA",
      type: "percent",
      value: 10,
      min_order_value: 0,
      expires_at: "",
      active: true,
      allow_on_sale: false,
    },
    {
      id: "fixed",
      code: "AMORA15",
      type: "fixed",
      value: 15,
      min_order_value: 120,
      expires_at: "",
      active: true,
      allow_on_sale: true,
    },
  ],
  banners: [
    {
      id: "b1",
      image_url: makeEditorialPlaceholder(
        "Semijoias, Bolsas & Maquiagens",
        "Curadoria Amora Acessórios",
        "plum",
        { width: 1600, height: 900 },
      ),
      alt: "Banner Amora Acessórios — Semijoias, bolsas e maquiagens",
      active: true,
      filter: "",
    },
    {
      id: "b2",
      image_url: makeEditorialPlaceholder(
        "Venda e Aluguel de Bolsas",
        "Clutches & Bolsas para Festas",
        "champagne",
        { width: 1600, height: 900 },
      ),
      alt: "Banner Amora Acessórios — Aluguel de Bolsas",
      active: true,
      filter: "Aluguel de Bolsas",
    },
    {
      id: "b3",
      image_url: makeEditorialPlaceholder(
        "Makes a partir de R$ 10",
        "Beleza para todos os momentos",
        "ivory",
        { width: 1600, height: 900 },
      ),
      alt: "Banner Amora Acessórios — Maquiagens",
      active: true,
      filter: "Maquiagens",
    },
  ],
  announcement: {
    active: true,
    text: "✨ Ganhe uma Consultoria de Automaquiagem nas compras a partir de R$ 150 (ou R$ 100 cada com uma amiga)!",
    link: "#promocao",
    promo_campaign_active: true,
  },
  profile: { name: "Administradora", email: "", avatar: "" },
};
export const DEFAULT_CATEGORIES = [
  "Semijoias",
  "Bolsas",
  "Aluguel de Bolsas",
  "Maquiagens",
  "Anéis",
  "Colares",
  "Brincos",
  "Pulseiras",
  "Conjuntos",
] as const;
export const DEFAULT_MATERIALS = [
  "Semijoia",
  "Prata 925",
  "Bolsa",
  "Aluguel",
  "Maquiagem",
] as const;
export const categoriesList: string[] = [...DEFAULT_CATEGORIES];
export const materialsList: string[] = [...DEFAULT_MATERIALS];
export const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const priceOf = (p: Product) => (p.is_on_sale ? p.sale_price : p.price);

const RENT_LABELS = new Set(["aluguel", "aluguel de bolsas"]);

export function isRentProduct(
  product: Pick<Product, "category" | "material"> & { listing_type?: ProductListingType },
): boolean {
  if (product.listing_type === "rent") return true;
  const cat = (product.category ?? "").trim().toLocaleLowerCase("pt-BR");
  const mat = (product.material ?? "").trim().toLocaleLowerCase("pt-BR");
  return RENT_LABELS.has(cat) || RENT_LABELS.has(mat);
}

export function resolveListingType(
  rawListingType: unknown,
  category: string,
  material: string,
): ProductListingType {
  if (rawListingType === "rent") return "rent";
  return isRentProduct({ listing_type: "sale", category, material }) ? "rent" : "sale";
}

export function getTodayLocalIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateBr(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate.trim();
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function buildRentWhatsAppMessage(params: {
  product: Product;
  eventDateIso: string;
  customerName?: string;
  productUrl: string;
}): string {
  const formattedPrice = money(priceOf(params.product));
  const formattedDate = formatDateBr(params.eventDateIso);
  const trimmedName = (params.customerName ?? "").trim();
  const lines = [
    "Olá, Amora Acessórios! ✨",
    "Gostaria de consultar a disponibilidade de *aluguel* da peça:",
    "",
    `• *${params.product.name}* (${formattedPrice} / aluguel)`,
    `📅 Data do evento: ${formattedDate}`,
    ...(trimmedName ? [`👤 Nome: ${trimmedName}`] : []),
    `🔗 Link da peça: ${params.productUrl}`,
    "",
    "Aguardo a confirmação da disponibilidade!",
  ];
  return lines.join("\n");
}
