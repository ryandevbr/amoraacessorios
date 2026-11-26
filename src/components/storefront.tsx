import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Search,
  ShoppingBag,
  Sparkles,
  MapPin,
  ShieldCheck,
  MessageCircle,
  Instagram,
  LockKeyhole,
  Plus,
  Minus,
  Trash2,
  Share2,
  Check,
  Heart,
  X,
  Gift,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useStore } from "@/services/storeService";
import {
  mergeOptionValues,
  optionLookupKey,
  useCatalogOptions,
} from "@/services/catalogOptionsService";
import { calculateCoupon, normalizeCode, type CartItem } from "@/services/couponService";
import {
  buildRentWhatsAppMessage,
  getTodayLocalIsoDate,
  isRentProduct,
  money,
  priceOf,
  shouldShowPromotion,
  type Product,
} from "@/data/catalog";
import { storeContent } from "@/data/storeContent";

function matchesFilter(product: Product, selected: string): boolean {
  if (selected === "Todos") return true;
  if (selected === "Promoções") return product.is_on_sale;
  const target = optionLookupKey(selected);
  const productCategory = optionLookupKey(product.category);
  const productMaterial = optionLookupKey(product.material);
  if (target === "semijoias" && productMaterial === "semijoia") return true;
  if (target === "bolsas" && productMaterial === "bolsa") return true;
  if (target === "maquiagens" && productMaterial === "maquiagem") return true;
  if (target === "aluguel de bolsas" && (productMaterial === "aluguel" || isRentProduct(product)))
    return true;
  if (
    target === "aluguel" &&
    (productCategory === "aluguel de bolsas" || isRentProduct(product))
  )
    return true;
  return productCategory === target || productMaterial === target;
}

function getMaterialBadgeClass(material: string): string {
  const key = optionLookupKey(material);
  if (key.includes("aluguel")) {
    return "bg-primary/95 text-primary-foreground border border-gold/45 backdrop-blur-sm";
  }
  if (key.includes("prata")) {
    return "bg-background/95 text-foreground border border-border/90 backdrop-blur-sm";
  }
  if (key.includes("semijoia") || key.includes("ouro") || key.includes("dourad")) {
    return "bg-secondary/95 text-foreground border border-gold/50 backdrop-blur-sm";
  }
  if (key.includes("bolsa")) {
    return "bg-secondary/95 text-primary border border-primary/20 backdrop-blur-sm";
  }
  if (key.includes("maquiag") || key.includes("make")) {
    return "bg-background/95 text-primary border border-gold/55 backdrop-blur-sm";
  }
  return "bg-background/95 text-foreground/90 border border-border/80 backdrop-blur-sm";
}

const PRODUCTS_PER_PAGE = 16;

export function Storefront() {
  const { data, loading, error } = useStore({ scope: "public" });
  const { categoryNames, materialNames } = useCatalogOptions();
  const [filter, setFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);
  const [product, setProduct] = useState<Product | null>(null);
  const [bag, setBag] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [rentDate, setRentDate] = useState("");
  const [rentName, setRentName] = useState("");
  const rentDateInputRef = useRef<HTMLInputElement>(null);
  const [slide, setSlide] = useState(0);
  const todayIso = getTodayLocalIsoDate();
  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem("amora-bag") ?? "[]"));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const id = new URL(window.location.href).searchParams.get("produto");
    if (id) {
      const p = data.products.find((p) => p.id === id && p.active);
      if (p) {
        setProduct(p);
        document.getElementById("vitrine")?.scrollIntoView();
      }
    }
  }, [ready, data.products]);
  useEffect(() => {
    if (ready) localStorage.setItem("amora-bag", JSON.stringify(cart));
  }, [cart, ready]);
  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_PAGE);
  }, [filter, query, sort]);
  const banners = data.banners.filter((b) => b.active);
  const currentSlide = banners.length > 0 ? slide % banners.length : 0;
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || banners.length < 2) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % banners.length), 3000);
    return () => clearInterval(timer);
  }, [banners.length]);
  function open(p: Product | null) {
    setProduct(p);
    setRentDate("");
    const url = new URL(window.location.href);
    if (p) url.searchParams.set("produto", p.id);
    else url.searchParams.delete("produto");
    window.history.replaceState({}, "", url);
  }
  function add(p: Product) {
    if (!p.in_stock || isRentProduct(p)) return;
    setCart((c) => {
      const old = c.find((i) => i.product.id === p.id);
      return old
        ? c.map((i) => (i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...c, { product: p, quantity: 1 }];
    });
    toast.success("Peça adicionada à sacola");
  }
  function handleConsultRent(p: Product) {
    if (!rentDate) {
      toast.error("Selecione a data do evento para consultar a disponibilidade.");
      rentDateInputRef.current?.focus();
      return;
    }
    const productUrl = `${window.location.origin}/?produto=${p.id}`;
    const message = buildRentWhatsAppMessage({
      product: p,
      eventDateIso: rentDate,
      customerName: rentName,
      productUrl,
    });
    window.open(
      `${storeContent.whatsapp}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  const activeProducts = data.products.filter((p) => p.active);
  const dynamicMaterials = mergeOptionValues(
    materialNames,
    activeProducts.map((p) => p.material),
  );
  const dynamicCategories = mergeOptionValues(
    categoryNames,
    activeProducts.map((p) => p.category),
  );
  const filters = [
    "Todos",
    "Promoções",
    ...mergeOptionValues([...dynamicCategories, ...dynamicMaterials]),
  ];
  const filteredProducts = activeProducts
    .filter(
      (p) =>
        matchesFilter(p, filter) &&
        `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? priceOf(a) - priceOf(b)
        : sort === "high"
          ? priceOf(b) - priceOf(a)
          : Number(b.featured) - Number(a.featured),
    );
  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const remainingCount = Math.max(0, filteredProducts.length - visibleCount);
  const nextBatchCount = Math.min(PRODUCTS_PER_PAGE, remainingCount);
  const coupon = data.coupons.find((c) => c.code === applied);
  const totals = calculateCoupon(cart, coupon);
  const subtotal = cart.reduce((s, i) => s + priceOf(i.product) * i.quantity, 0);
  const discount = applied && !totals.error ? totals.discount : 0;
  const total = subtotal - discount;
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const showPromotion = shouldShowPromotion(data.announcement);
  const scroll = (f: string) => {
    const targetKey = optionLookupKey(f);
    const matched =
      filters.find((item) => optionLookupKey(item) === targetKey) ??
      (targetKey === "semijoias"
        ? filters.find((item) => optionLookupKey(item) === "semijoia")
        : undefined);
    setFilter(matched ?? f);
    document.getElementById("vitrine")?.scrollIntoView({ behavior: "smooth" });
  };
  async function share(p: Product) {
    const url = `${window.location.origin}/?produto=${p.id}`;
    try {
      if (navigator.share) await navigator.share({ title: p.name, text: storeContent.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch {}
  }
  const checkout = () => {
    const lines = [
      "Olá, Amora Acessórios! ✨",
      "Gostaria de finalizar meu pedido feito pelo site:",
      "",
      cart
        .map(
          (i) =>
            `• *${i.product.name}* (${i.product.material})${i.product.is_on_sale ? " (Promoção)" : ""} — Qtd: ${i.quantity} — ${money(priceOf(i.product) * i.quantity)}`,
        )
        .join("\n\n"),
      "",
      `Subtotal: ${money(subtotal)}`,
      ...(discount
        ? [
            `Cupom aplicado: ${applied} (- ${money(discount)})`,
            ...(totals.mixed ? ["(Cupom aplicado apenas nos itens sem promoção)"] : []),
          ]
        : []),
      `Total estimado: ${money(total)}`,
      "",
      ...(name ? [`Nome: ${name}`] : []),
      ...(city ? [`Bairro/Cidade ou Retirada: ${city}`] : []),
      "",
      "Aguardo para combinarmos a retirada no Olaria, entrega ou forma de pagamento!",
    ];
    window.open(
      `${storeContent.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <>
      {data.announcement.active && data.announcement.text.trim() && (
        <div className="bg-primary text-primary-foreground text-center px-4 py-2.5 text-[10px] sm:text-xs">
          <a
            href={
              !showPromotion &&
              (data.announcement.link === "#promocoes" || data.announcement.link === "#promocao")
                ? "#vitrine"
                : data.announcement.link || "#vitrine"
            }
            className="inline-flex gap-2 items-center"
          >
            {!data.announcement.text.trim().startsWith("✨") && (
              <Sparkles size={12} className="text-gold-light shrink-0" />
            )}
            <span>{data.announcement.text}</span>
          </a>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="shell flex items-center justify-between gap-3 md:grid md:grid-cols-[1fr_auto_1fr] h-17 sm:h-18.5 md:h-20">
          <a
            href="#inicio"
            aria-label="Amora Acessórios — início"
            className="inline-flex items-center shrink-0"
          >
            <BrandLogo size="md" />
          </a>
          <nav className="hidden md:flex justify-center gap-7 text-xs text-muted-foreground">
            <a href="#inicio" className="transition-colors hover:text-primary">
              Início
            </a>
            <a href="#vitrine" className="transition-colors hover:text-primary">
              Vitrine
            </a>
            <a href="#como-comprar" className="transition-colors hover:text-primary">
              Como comprar
            </a>
            <a href="#onde-estamos" className="transition-colors hover:text-primary">
              Onde estamos
            </a>
            <a href="#sobre" className="transition-colors hover:text-primary">
              Sobre
            </a>
          </nav>
          <div className="flex gap-2 sm:gap-4 justify-end items-center shrink-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buscar peças"
              onClick={() => {
                document.getElementById("vitrine")?.scrollIntoView();
                document.getElementById("search")?.focus();
              }}
            >
              <Search />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setBag(true)}
              aria-label={`Sacola com ${count} itens`}
              className="px-0 gap-2"
            >
              <ShoppingBag />
              <span className="hidden sm:inline text-xs">Sacola</span>
              <span className="rounded-full bg-secondary border border-gold-light/70 text-primary font-medium text-[10px] h-5 w-5 grid place-items-center">
                {count}
              </span>
            </Button>
          </div>
        </div>
      </header>
      <main>
        <section id="inicio" className="hero">
          <div className="hero-media aspect-video md:aspect-auto">
            {banners.map((b, i) => (
              <img
                key={b.id}
                src={b.image_url}
                alt={b.alt || "Banner Amora Acessórios"}
                onClick={() => b.filter && scroll(b.filter)}
                className={`hero-photo w-full h-full object-cover object-center ${
                  i === currentSlide ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
              />
            ))}
            <div className="hero-scrim pointer-events-none" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-linear-to-t from-muted to-transparent md:hidden"
            />
            {banners.length > 1 && (
              <div className="absolute bottom-3 right-4 md:bottom-6 md:right-8 z-10 flex gap-2">
                {banners.map((b, i) => (
                  <Button
                    key={b.id}
                    variant="ghost"
                    className={`p-0 h-2 w-2 rounded-full ${i === currentSlide ? "bg-primary" : "bg-foreground/25"}`}
                    aria-label={`Foto ${i + 1}`}
                    onClick={() => setSlide(i)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="shell hero-content bg-muted md:bg-transparent pointer-events-none">
            <div className="max-w-135 pointer-events-auto">
              <p className="eyebrow text-muted-foreground flex gap-2 items-center mb-4 md:mb-5">
                <Sparkles size={15} className="text-gold shrink-0" /> {storeContent.subtitle}
              </p>
              <h1 className="text-foreground">
                Realce sua beleza
                <br />
                em cada detalhe:
                <br />
                <em className="text-primary">semijoias, bolsas &amp; makes</em>
              </h1>
              <p className="text-muted-foreground text-sm leading-7 mt-4 md:mt-6 max-w-105">
                Semijoias elegantes, venda e aluguel de bolsas para ocasiões especiais e maquiagens
                a partir de R$ 10. Atendimento acolhedor no bairro Olaria, em Timóteo, e pelo
                WhatsApp.
              </p>
              <div className="flex flex-wrap gap-3 mt-6 md:mt-7">
                <Button size="lg" onClick={() => scroll("Todos")}>
                  Ver vitrine <ArrowRight />
                </Button>
                <Button size="lg" variant="editorial" asChild>
                  <a href={storeContent.whatsapp} target="_blank" rel="noreferrer">
                    <MessageCircle />
                    Chamar no WhatsApp
                  </a>
                </Button>
              </div>
              <a
                href="#loja-fisica"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("loja-fisica")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex gap-2 items-center text-[11px] text-muted-foreground hover:text-primary transition-colors mt-5 scroll-smooth"
              >
                <MapPin size={14} className="text-gold shrink-0" />
                {storeContent.address} <ArrowRight size={12} />
              </a>
            </div>
          </div>
        </section>
        <div className="bg-background border-b">
          <div className="shell grid grid-cols-2 md:grid-cols-4 py-6 gap-5 text-[11px] text-muted-foreground">
            {[
              [Sparkles, "Semijoias & Prata 925"],
              [ShoppingBag, "Venda e Aluguel de Bolsas"],
              [Heart, "Maquiagens a partir de R$ 10"],
              [MapPin, "Loja física no Olaria · Timóteo"],
            ].map(([Icon, text], i) => {
              const C = Icon as typeof Sparkles;
              return (
                <div key={i} className="flex justify-center items-center gap-2">
                  <C size={17} className="text-gold shrink-0" />
                  <span>{text as string}</span>
                </div>
              );
            })}
          </div>
        </div>
        {showPromotion && (
          <section id="promocoes" className="shell pt-12 md:pt-16 scroll-mt-24">
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#F3ECE2] to-[#FCF9F5] border border-[#B88B58]/30 shadow-xs px-6 py-8 sm:px-10 sm:py-10 md:px-14 md:py-12">
              <div className="max-w-2xl mx-auto text-center">
                {data.announcement.promo_badge.trim() && (
                  <p className="inline-flex items-center gap-2 rounded-full border border-[#B88B58]/35 bg-background/85 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                    <Sparkles size={13} className="text-gold shrink-0" />
                    <span>{data.announcement.promo_badge}</span>
                  </p>
                )}
                <h2 className="font-display text-3xl sm:text-4xl md:text-[42px] leading-[1.15] text-primary mt-4">
                  {data.announcement.promo_title}
                </h2>
                {data.announcement.promo_description.trim() && (
                  <p className="text-sm sm:text-[15px] text-foreground/85 leading-7 whitespace-pre-line mt-5 max-w-xl mx-auto text-left sm:text-center">
                    {data.announcement.promo_description}
                  </p>
                )}
                {data.announcement.promo_highlight.trim() && (
                  <div className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-[#B88B58]/35 bg-background/90 px-4 py-2.5 text-xs font-medium text-primary">
                    <Gift size={14} className="text-gold shrink-0" />
                    <span>{data.announcement.promo_highlight}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        <section id="vitrine" className="shell pt-16 pb-20">
          <div className="text-center">
            <p className="eyebrow text-gold mb-3">Curadoria Amora Acessórios</p>
            <h2 className="section-title">Um toque de elegância para cada momento</h2>
            <p className="text-sm text-muted-foreground mt-3">
              Semijoias, bolsas para compra ou aluguel e maquiagens a partir de R$ 10.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {filters.map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "ghost"}
                className={`filter-pill ${filter !== f ? "border border-border" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f}
                {f === "Promoções" && <Sparkles size={12} />}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mt-8 mb-6">
            <div className="relative w-full max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="search"
                aria-label="Buscar por nome ou SKU"
                placeholder="Buscar semijoias, bolsas ou makes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10! bg-muted text-sm"
              />
            </div>
            <select
              aria-label="Ordenar produtos"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-auto text-xs border-0"
            >
              <option value="featured">Destaques</option>
              <option value="low">Menor preço</option>
              <option value="high">Maior preço</option>
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
            {visibleProducts.map((p) => {
              const isRent = isRentProduct(p);
              return (
                <article key={p.id}>
                  <div className="product-image">
                    <Button
                      variant="ghost"
                      className="w-full h-full p-0 rounded-none"
                      onClick={() => open(p)}
                      aria-label={`Ver ${p.name}`}
                    >
                      <img
                        src={p.image_url}
                        alt={`${p.name} — ${p.material}`}
                        loading="lazy"
                        decoding="async"
                      />
                    </Button>
                    <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 pointer-events-none">
                      {isRent && (
                        <span className="bg-primary text-primary-foreground px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider">
                          ALUGUEL
                        </span>
                      )}
                      {p.is_on_sale ? (
                        <span className="bg-primary text-primary-foreground px-2 py-1 text-[9px] uppercase tracking-wide">
                          {p.sale_label || `${((1 - p.sale_price / p.price) * 100).toFixed(0)}% OFF`}
                        </span>
                      ) : p.featured ? (
                        <span className="bg-background/95 text-primary border border-gold-light/70 px-2 py-1 text-[9px] uppercase tracking-wide">
                          Destaque
                        </span>
                      ) : null}
                      {!p.in_stock && (
                        <span className="bg-foreground text-background px-2 py-1 text-[9px]">
                          Indisponível
                        </span>
                      )}
                    </div>
                    <span
                      className={`absolute bottom-3 left-3 max-w-[calc(100%-24px)] truncate rounded-sm px-2 py-1 text-[9px] font-medium tracking-wide shadow-xs ${getMaterialBadgeClass(p.material)}`}
                    >
                      {p.material}
                    </span>
                  </div>
                  <Button
                    variant="link"
                    onClick={() => open(p)}
                    className="text-foreground p-0 h-auto whitespace-normal justify-start text-left mt-4 text-xs font-medium"
                  >
                    {p.name}
                  </Button>
                  <div className="flex gap-1.5 items-baseline mt-2 flex-wrap">
                    {p.is_on_sale && (
                      <del className="text-muted-foreground text-[10px]">{money(p.price)}</del>
                    )}
                    <span className="font-semibold text-sm">{money(priceOf(p))}</span>
                    {isRent && (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        / aluguel
                      </span>
                    )}
                  </div>
                  {isRent ? (
                    <Button
                      variant="editorial"
                      className="w-full text-[10px] mt-3 h-9 gap-2 px-1"
                      disabled={!p.in_stock}
                      onClick={() => open(p)}
                    >
                      <Calendar size={13} />
                      {p.in_stock ? "Consultar aluguel" : "Indisponível"}
                    </Button>
                  ) : (
                    <Button
                      variant="editorial"
                      className="w-full text-[10px] mt-3 h-9 gap-2 px-1"
                      disabled={!p.in_stock}
                      onClick={() => add(p)}
                    >
                      <Plus size={13} />
                      {p.in_stock ? "Adicionar à sacola" : "Indisponível"}
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
          {loading && filteredProducts.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">Carregando vitrine...</p>
          ) : error && filteredProducts.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              Não foi possível carregar o catálogo no momento.
            </p>
          ) : (
            filteredProducts.length === 0 && (
              <p className="py-16 text-center text-muted-foreground">Nenhuma peça encontrada.</p>
            )
          )}
          {filteredProducts.length > 0 && (
            <div className="mt-10 flex flex-col items-center gap-4">
              <p className="text-center text-xs text-muted-foreground">
                Exibindo {visibleProducts.length} de {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "peça" : "peças"}
              </p>
              {visibleCount < filteredProducts.length && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVisibleCount((prev) => prev + PRODUCTS_PER_PAGE)}
                  className="min-h-11 px-8 rounded-full border-primary bg-transparent text-primary text-xs font-medium tracking-wide transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Ver mais {nextBatchCount} {nextBatchCount === 1 ? "peça" : "peças"}
                </Button>
              )}
            </div>
          )}
        </section>
        <section id="como-comprar" className="bg-muted py-16">
          <div className="shell">
            <div className="text-center">
              <p className="eyebrow text-gold mb-3">Da nossa vitrine para você</p>
              <h2 className="section-title">Comprar na Amora é simples e acolhedor.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-9 mt-12">
              {[
                "Escolha seus favoritos na vitrine",
                "Envie sua sacola pelo WhatsApp",
                "Retire no Olaria ou receba em casa",
              ].map((t, i) => (
                <div key={t} className="text-center">
                  <span className="font-display text-gold text-4xl">0{i + 1}</span>
                  <h3 className="text-2xl mt-4">{t}</h3>
                  <p className="text-xs text-muted-foreground leading-6 mt-2">
                    {
                      [
                        "Explore semijoias, bolsas para venda ou aluguel e maquiagens a partir de R$ 10.",
                        `Seu pedido chega prontinho no ${storeContent.whatsappDisplay} para nosso atendimento.`,
                        "Combine retirada pessoalmente no bairro Olaria, entrega em Timóteo/região ou forma de pagamento.",
                      ][i]
                    }
                  </p>
                </div>
              ))}
            </div>
            <div
              id="onde-estamos"
              className="grid md:grid-cols-3 gap-8 border-t mt-12 pt-10 text-xs text-muted-foreground scroll-mt-28"
            >
              <a
                id="loja-fisica"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeContent.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="scroll-mt-28 sm:scroll-mt-32 flex flex-col justify-between rounded-lg bg-background/80 border border-gold-light/60 p-6 transition-all hover:border-[#B88B58]/60 hover:shadow-md cursor-pointer"
              >
                <div>
                  <MapPin size={21} className="text-gold mb-3" />
                  <p className="eyebrow text-gold mb-1.5">Onde estamos</p>
                  <h3 className="text-xl text-foreground">Loja física &amp; retirada no Olaria</h3>
                  <p className="text-foreground font-medium mt-3">{storeContent.address}</p>
                  <p className="leading-6 mt-2">
                    Retire seu pedido pessoalmente na loja no bairro Olaria ou solicite entrega em
                    Timóteo e região.
                  </p>
                </div>
                <p className="mt-5 pt-3 border-t border-border/60 text-primary font-medium text-xs">
                  Ver localização no Google Maps ↗
                </p>
              </a>
              <div className="rounded-lg bg-background/80 border border-border p-6">
                <ShoppingBag size={21} className="text-gold mb-3" />
                <p className="eyebrow text-gold mb-1.5">Eventos &amp; praticidade</p>
                <h3 className="text-xl text-foreground">Aluguel de bolsas &amp; entregas</h3>
                <p className="leading-6 mt-2">
                  Vai a uma festa, casamento ou formatura? Consulte condições e disponibilidade para
                  aluguel de bolsas e clutches. Também realizamos entregas em Timóteo e região, com
                  pagamento via Pix ou cartão.
                </p>
                <div className="flex flex-wrap gap-4 mt-4">
                  <button
                    type="button"
                    onClick={() => scroll("Aluguel de Bolsas")}
                    className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline cursor-pointer"
                  >
                    Ver aluguel de bolsas <ArrowRight size={12} />
                  </button>
                  <a
                    href={`${storeContent.whatsapp}?text=${encodeURIComponent("Olá, Amora Acessórios! ✨ Gostaria de consultar condições e disponibilidade para aluguel de bolsas.")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
                  >
                    Consultar no WhatsApp
                  </a>
                </div>
              </div>
              <div className="rounded-lg bg-background/80 border border-border p-6">
                <ShieldCheck size={21} className="text-gold mb-3" />
                <p className="eyebrow text-gold mb-1.5">Informações úteis</p>
                <h3 className="text-xl text-foreground">Cuidados e dúvidas</h3>
                {[
                  "Como funciona o aluguel de bolsas?",
                  "Como cuidar das Semijoias e Prata 925?",
                  "Formas de pagamento e retirada",
                ].map((q, i) => (
                  <details key={q} className="border-b last:border-b-0 py-3">
                    <summary className="cursor-pointer text-foreground/90 font-medium">{q}</summary>
                    <p className="leading-6 mt-2">
                      {
                        [
                          `Escolha seu modelo favorito e fale conosco pelo WhatsApp ${storeContent.whatsappDisplay} para confirmar datas, valores e retirada na loja.`,
                          "Evite contato com perfumes, cremes, banho e piscina. Limpe com flanela macia e guarde cada peça separadamente.",
                          `Aceitamos Pix e cartão. Você pode retirar na ${storeContent.address} ou combinar entrega em Timóteo e região.`,
                        ][i]
                      }
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section id="sobre" className="shell py-20 text-center max-w-3xl">
          <Sparkles className="mx-auto text-gold mb-5" size={25} />
          <p className="eyebrow text-gold mb-3">Nossa essência</p>
          <h2 className="section-title">Elegância nos detalhes que acompanham você.</h2>
          <p className="text-sm text-muted-foreground leading-8 mt-6">{storeContent.about}</p>
          <a
            href={storeContent.instagram}
            target="_blank"
            rel="noreferrer"
            className="inline-block font-display italic text-2xl text-primary hover:text-gold transition-colors mt-6"
          >
            Com carinho, {storeContent.name} · {storeContent.instagramHandle}
          </a>
        </section>
      </main>
      <footer className="bg-secondary/75 border-t border-border pt-10 pb-24 md:pb-8">
        <div className="shell grid md:grid-cols-[1fr_1fr_1fr] gap-6 items-center">
          <div>
            <BrandLogo size="md" />
            <p className="text-[11px] text-muted-foreground mt-3">{storeContent.subtitle}</p>
          </div>
          <div className="text-xs text-muted-foreground md:text-center leading-6 space-y-1">
            <p className="text-foreground font-medium">{storeContent.address}</p>
            <p>Retirada na loja · Entregas em Timóteo e região</p>
            <p>
              <a
                href={storeContent.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-primary"
              >
                WhatsApp: {storeContent.whatsappDisplay}
              </a>
            </p>
          </div>
          <div className="flex flex-col md:items-end gap-2">
            <div className="flex md:justify-end gap-2">
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={storeContent.instagram}
                  aria-label={`Instagram ${storeContent.instagramHandle}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Instagram />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={storeContent.whatsapp}
                  aria-label={`WhatsApp ${storeContent.whatsappDisplay}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle />
                </a>
              </Button>
            </div>
            <a
              href={storeContent.instagram}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              {storeContent.instagramHandle}
            </a>
          </div>
        </div>
        <div className="shell mt-8 pt-5 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3 text-center text-[11px] text-muted-foreground">
            <p className="order-2 md:order-1 md:text-left md:justify-self-start">
              Feito por{" "}
              <a
                href="https://instagram.com/ryan.devbr"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                @ryan.devbr
              </a>
            </p>
            <p className="order-1 md:order-2 md:text-center md:justify-self-center">
              © 2026 {storeContent.name}. Todos os direitos reservados.
            </p>
            <Link
              to="/login"
              className="order-3 inline-flex items-center justify-center gap-1.5 shrink-0 justify-self-center md:justify-self-end md:text-right md:pr-20 transition-colors hover:text-foreground"
            >
              <LockKeyhole size={12} />
              Área restrita
            </Link>
          </div>
        </div>
      </footer>
      <Button className="floating-chat" asChild>
        <a
          href={storeContent.whatsapp}
          aria-label="Conversar pelo WhatsApp"
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="size-6!" />
        </a>
      </Button>
      <Dialog open={!!product} onOpenChange={(v) => !v && open(null)}>
        <DialogContent className="modal-product" onOpenAutoFocus={(e) => e.preventDefault()}>
          {product &&
            (isRentProduct(product) ? (
              <div className="modal-scroll bg-background">
                <div className="relative bg-muted">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full object-contain max-h-[46dvh] bg-muted"
                  />
                  <div className="absolute top-3.5 left-3.5 flex flex-col items-start gap-1.5 pointer-events-none">
                    <span className="rounded-full bg-primary text-primary-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] shadow-xs">
                      ALUGUEL
                    </span>
                    {product.featured && (
                      <span className="rounded-full bg-primary text-primary-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] shadow-xs">
                        DESTAQUE
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-background p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <DialogTitle className="font-display text-3xl sm:text-[32px] leading-tight text-foreground">
                      {product.name}
                    </DialogTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => share(product)}
                      className="shrink-0 rounded-full border-border bg-background px-3.5 h-9 text-xs font-medium text-foreground hover:bg-secondary gap-1.5"
                    >
                      <Share2 size={13} />
                      Compartilhar
                    </Button>
                  </div>
                  <div className="flex items-baseline gap-2 mt-3 flex-wrap">
                    {product.is_on_sale && (
                      <del className="text-muted-foreground text-sm">{money(product.price)}</del>
                    )}
                    <strong className="text-2xl font-semibold text-foreground">
                      {money(priceOf(product))}
                    </strong>
                    <span className="text-sm text-muted-foreground font-normal">/ aluguel</span>
                  </div>
                  {product.is_on_sale && (
                    <p className="text-primary text-xs mt-1.5">
                      Economize {money(product.price - product.sale_price)}
                    </p>
                  )}
                  <DialogDescription className="mt-4 leading-7 text-sm text-muted-foreground">
                    {product.description}
                  </DialogDescription>
                  {product.characteristics.length > 0 && (
                    <dl className="mt-4 text-xs border-t border-border/70">
                      {product.characteristics.map((c, i) => (
                        <div className="flex justify-between py-2.5 border-b border-border/70" key={i}>
                          <dt className="text-muted-foreground">{c.attribute}</dt>
                          <dd className="text-foreground">{c.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="mt-5 pt-5 border-t border-border space-y-4">
                    <label className="text-xs font-medium text-foreground">
                      Data do evento
                      <input
                        ref={rentDateInputRef}
                        type="date"
                        min={todayIso}
                        value={rentDate}
                        onChange={(e) => setRentDate(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                      />
                    </label>
                    <label className="text-xs font-medium text-foreground">
                      Seu nome (opcional)
                      <input
                        type="text"
                        placeholder="Como podemos te chamar?"
                        value={rentName}
                        onChange={(e) => setRentName(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-gold"
                      />
                    </label>
                    <p className="text-center italic text-xs text-muted-foreground pt-1">
                      A disponibilidade é confirmada na hora pelo nosso WhatsApp.
                    </p>
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => handleConsultRent(product)}
                      className="w-full min-h-12 h-auto py-3.5 px-5 rounded-full bg-linear-to-r from-[#D8B47C] to-[#B88B58] text-[#24161B] hover:brightness-95 font-semibold uppercase tracking-wider text-xs whitespace-normal text-center shadow-sm transition-all"
                    >
                      <MessageCircle size={18} className="shrink-0" />
                      CONSULTAR DISPONIBILIDADE NO WHATSAPP
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="modal-scroll">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full object-contain max-h-[55dvh] bg-muted"
                />
                <div className="p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wide ${getMaterialBadgeClass(product.material)}`}
                    >
                      {product.material}
                    </span>
                    <span className="eyebrow text-muted-foreground">{product.category}</span>
                  </div>
                  <DialogTitle className="font-display text-3xl">{product.name}</DialogTitle>
                  <div className="flex items-center gap-3 mt-4">
                    {product.is_on_sale && (
                      <del className="text-muted-foreground text-sm">{money(product.price)}</del>
                    )}
                    <strong className="text-xl">{money(priceOf(product))}</strong>
                  </div>
                  {product.is_on_sale && (
                    <p className="text-primary text-xs mt-2">
                      Economize {money(product.price - product.sale_price)}
                    </p>
                  )}
                  <DialogDescription className="mt-5 leading-7 text-sm">
                    {product.description}
                  </DialogDescription>
                  <dl className="mt-5 text-xs">
                    {product.characteristics.map((c, i) => (
                      <div className="flex justify-between py-3 border-b" key={i}>
                        <dt className="text-muted-foreground">{c.attribute}</dt>
                        <dd>{c.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex gap-2 mt-6">
                    <Button
                      className="flex-1"
                      size="lg"
                      onClick={() => {
                        if (product.in_stock) add(product);
                        else
                          window.open(
                            `${storeContent.whatsapp}?text=${encodeURIComponent(`Olá, Amora Acessórios! ✨ Gostaria de ser avisada quando ${product.name} estiver disponível.`)}`,
                            "_blank",
                          );
                      }}
                    >
                      <ShoppingBag />
                      {product.in_stock ? "Adicionar à sacola" : "Avise-me no WhatsApp"}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      aria-label="Compartilhar"
                      onClick={() => share(product)}
                    >
                      <Share2 />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </DialogContent>
      </Dialog>
      <Dialog open={bag} onOpenChange={setBag}>
        <DialogContent variant="drawer" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogTitle className="font-display text-3xl">
            Sua sacola <span className="text-primary">({count})</span>
          </DialogTitle>
          <DialogDescription className="text-xs mt-2">
            Retirada no Olaria, Timóteo ou entrega combinada no WhatsApp.
          </DialogDescription>
          <div className="flex-1 overflow-y-auto min-h-0 py-5">
            {!cart.length ? (
              <div className="text-center py-14">
                <ShoppingBag className="mx-auto text-muted-foreground mb-5" size={40} />
                <p className="text-sm text-muted-foreground">
                  Sua sacola está esperando seus favoritos.
                </p>
                <Button
                  className="mt-5"
                  onClick={() => {
                    setBag(false);
                    scroll("Todos");
                  }}
                >
                  Explorar a vitrine <ArrowRight />
                </Button>
              </div>
            ) : (
              <>
                {cart.map((i) => (
                  <div key={i.product.id} className="flex gap-4 border-b py-4">
                    <img
                      src={i.product.image_url}
                      alt={i.product.name}
                      className="w-20 h-24 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{i.product.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{i.product.material}</p>
                      <p className="text-xs mt-2">{money(priceOf(i.product))}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Diminuir ${i.product.name}`}
                            onClick={() =>
                              setCart((c) =>
                                c.flatMap((row) =>
                                  row.product.id === i.product.id
                                    ? row.quantity > 1
                                      ? [{ ...row, quantity: row.quantity - 1 }]
                                      : []
                                    : [row],
                                ),
                              )
                            }
                          >
                            <Minus size={12} />
                          </Button>
                          <span className="text-xs">{i.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Aumentar ${i.product.name}`}
                            onClick={() =>
                              setCart((c) =>
                                c.map((row) =>
                                  row.product.id === i.product.id
                                    ? { ...row, quantity: row.quantity + 1 }
                                    : row,
                                ),
                              )
                            }
                          >
                            <Plus size={12} />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${i.product.name}`}
                          onClick={() =>
                            setCart((c) => c.filter((row) => row.product.id !== i.product.id))
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="mt-6">
                  <label>
                    Cupom de desconto
                    <div className="flex gap-2">
                      <input
                        aria-label="Cupom de desconto"
                        placeholder="Seu cupom"
                        value={code}
                        onChange={(e) => setCode(normalizeCode(e.target.value))}
                      />
                      <Button
                        className="h-auto"
                        variant="outline"
                        onClick={() => {
                          const found = data.coupons.find((c) => c.code === normalizeCode(code));
                          const result = calculateCoupon(cart, found);
                          if (result.error) toast.error(result.error);
                          else {
                            setApplied(normalizeCode(code));
                            toast.success("Cupom aplicado!");
                          }
                        }}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </label>
                  {applied && (
                    <div className="mt-2 text-xs">
                      <div className="flex items-center justify-between text-primary">
                        <span>
                          <Check size={12} className="inline mr-1" />
                          {applied}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover cupom"
                          onClick={() => setApplied("")}
                        >
                          <X />
                        </Button>
                      </div>
                      {totals.error ? (
                        <p className="text-destructive">{totals.error}</p>
                      ) : (
                        totals.mixed && (
                          <p className="text-muted-foreground">
                            Cupom aplicado apenas nos itens sem promoção.
                          </p>
                        )
                      )}
                    </div>
                  )}
                  <div className="grid gap-3 mt-5">
                    <label>
                      Seu nome (opcional)
                      <input value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label>
                      Bairro / Cidade ou Retirada na loja (opcional)
                      <input
                        placeholder="Ex.: Retirar no Olaria ou Timóteo - MG"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
          {cart.length > 0 && (
            <div className="border-t pt-5 space-y-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-xs text-primary">
                  <span>Desconto ({applied})</span>
                  <span>− {money(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total estimado</span>
                <span>{money(total)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Retirada na loja (Olaria, Timóteo) ou entrega combinada pelo WhatsApp
              </p>
              <Button size="lg" className="w-full text-xs" onClick={checkout}>
                <MessageCircle />
                Finalizar pedido no WhatsApp <ArrowRight />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
