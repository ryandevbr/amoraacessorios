import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_STORE_PROMOTION,
  emptyStoreData,
  initialData,
  resolveListingType,
  type AdminProfile,
  type Banner,
  type Coupon,
  type Product,
  type ProductCharacteristic,
  type ProductListingType,
  type PromoCtaType,
  type StoreData,
  type StoreSettings,
} from "@/data/catalog";
import { isSupabaseConfigured, requireSupabase, supabase } from "@/lib/supabase";
import { normalizeCode } from "@/services/couponService";
import { deleteStoreImage } from "@/services/storageService";

const KEY = "amora-acessorios-store-v1";
const STORE_EVENT = "amora-store";
const DEFAULT_BANNER_ALT = "Banner Amora Acessórios";
const PROMO_FALLBACK_KEY = "amora-store-promo-fallback-v1";

type PromoFields = Pick<
  StoreSettings,
  | "promo_active"
  | "promo_badge"
  | "promo_title"
  | "promo_description"
  | "promo_highlight"
  | "promo_cta_label"
  | "promo_cta_type"
>;

function normalizePromoCtaType(raw: unknown): PromoCtaType {
  return raw === "whatsapp" ? "whatsapp" : "vitrine";
}

function readLocalPromoFallback(): PromoFields {
  if (typeof window === "undefined") return { ...DEFAULT_STORE_PROMOTION };
  try {
    const raw = window.localStorage.getItem(PROMO_FALLBACK_KEY);
    if (!raw) return { ...DEFAULT_STORE_PROMOTION };
    const parsed = JSON.parse(raw) as Partial<PromoFields>;
    return {
      promo_active:
        typeof parsed.promo_active === "boolean"
          ? parsed.promo_active
          : DEFAULT_STORE_PROMOTION.promo_active,
      promo_badge:
        typeof parsed.promo_badge === "string"
          ? parsed.promo_badge
          : DEFAULT_STORE_PROMOTION.promo_badge,
      promo_title:
        typeof parsed.promo_title === "string"
          ? parsed.promo_title
          : DEFAULT_STORE_PROMOTION.promo_title,
      promo_description:
        typeof parsed.promo_description === "string"
          ? parsed.promo_description
          : DEFAULT_STORE_PROMOTION.promo_description,
      promo_highlight:
        typeof parsed.promo_highlight === "string"
          ? parsed.promo_highlight
          : DEFAULT_STORE_PROMOTION.promo_highlight,
      promo_cta_label: "",
      promo_cta_type: normalizePromoCtaType(parsed.promo_cta_type),
    };
  } catch {
    return { ...DEFAULT_STORE_PROMOTION };
  }
}

function writeLocalPromoFallback(promo: PromoFields) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROMO_FALLBACK_KEY, JSON.stringify(promo));
  } catch {}
}

function isMissingPromoColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (error.message ?? "").includes("promo_")
  );
}

function isMissingListingTypeColumnError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (error.message ?? "").includes("listing_type")
  );
}

export type StoreScope = "public" | "admin";

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  material: string;
  listing_type?: string | null;
  price: number | string;
  sale_price: number | string | null;
  is_on_sale: boolean;
  sale_label: string | null;
  image_url: string | null;
  description: string | null;
  active: boolean;
  featured: boolean;
  in_stock: boolean;
  characteristics: unknown;
}

interface HeroBannerRow {
  id: string;
  image_url: string;
  mobile_image_url?: string | null;
  alt: string;
  active: boolean;
  filter: string | null;
  display_order: number | null;
}

interface StoreSettingsRow {
  id: number;
  announcement_active: boolean;
  announcement_text: string | null;
  announcement_link: string | null;
  promo_active?: boolean | null;
  promo_badge?: string | null;
  promo_title?: string | null;
  promo_description?: string | null;
  promo_highlight?: string | null;
  promo_cta_label?: string | null;
  promo_cta_type?: string | null;
}

interface CouponRow {
  id: string;
  code: string;
  type: string;
  value: number | string;
  min_order_value: number | string | null;
  expires_at: string | null;
  active: boolean;
  allow_on_sale: boolean;
}

interface AdminProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

function parseCharacteristics(raw: unknown): ProductCharacteristic[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is { attribute?: unknown; value?: unknown } =>
        item != null && typeof item === "object",
    )
    .map((item) => ({
      attribute: typeof item.attribute === "string" ? item.attribute : "",
      value: typeof item.value === "string" ? item.value : "",
    }));
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? "",
    category: row.category,
    material: row.material,
    listing_type: resolveListingType(row.listing_type, row.category, row.material),
    price: Number(row.price),
    sale_price: Number(row.sale_price ?? 0),
    is_on_sale: Boolean(row.is_on_sale),
    sale_label: row.sale_label ?? "",
    image_url: row.image_url ?? "",
    description: row.description ?? "",
    active: Boolean(row.active),
    featured: Boolean(row.featured),
    in_stock: Boolean(row.in_stock),
    characteristics: parseCharacteristics(row.characteristics),
  };
}

function mapBannerRow(row: HeroBannerRow, fallbackIndex: number): Banner {
  return {
    id: row.id,
    image_url: row.image_url,
    mobile_image_url: null,
    alt: row.alt?.trim() || DEFAULT_BANNER_ALT,
    active: Boolean(row.active),
    filter: row.filter ?? "",
    display_order: row.display_order ?? fallbackIndex,
  };
}

function mapCouponRow(row: CouponRow): Coupon {
  return {
    id: row.id,
    code: normalizeCode(row.code),
    type: row.type === "fixed" ? "fixed" : "percent",
    value: Number(row.value),
    min_order_value: Number(row.min_order_value ?? 0),
    expires_at: row.expires_at ?? "",
    active: Boolean(row.active),
    allow_on_sale: Boolean(row.allow_on_sale),
  };
}

function toProductPayload(product: Product) {
  const listingType: ProductListingType = product.listing_type === "rent" ? "rent" : "sale";
  return {
    id: product.id || crypto.randomUUID(),
    name: product.name.trim(),
    sku: product.sku.trim(),
    category: product.category,
    material: product.material,
    listing_type: listingType,
    price: Number(product.price),
    sale_price: product.is_on_sale
      ? Number(product.sale_price)
      : Math.max(0, Number(product.sale_price || 0)),
    is_on_sale: Boolean(product.is_on_sale),
    sale_label: product.sale_label.trim(),
    image_url: product.image_url.trim(),
    description: product.description.trim(),
    active: Boolean(product.active),
    featured: Boolean(product.featured),
    in_stock: Boolean(product.in_stock),
    characteristics: product.characteristics
      .map((item) => ({ attribute: item.attribute.trim(), value: item.value.trim() }))
      .filter((item) => item.attribute !== "" || item.value !== ""),
  };
}

function toBannerPayload(banner: Banner, displayOrder: number) {
  return {
    id: banner.id || crypto.randomUUID(),
    image_url: banner.image_url.trim(),
    mobile_image_url: null,
    alt: DEFAULT_BANNER_ALT,
    active: Boolean(banner.active),
    filter: banner.filter.trim(),
    display_order: displayOrder,
  };
}

function toCouponPayload(coupon: Coupon) {
  const normalizedExpiresAt = coupon.expires_at.trim();
  return {
    id: coupon.id || crypto.randomUUID(),
    code: normalizeCode(coupon.code),
    type: coupon.type === "fixed" ? "fixed" : "percent",
    value: Number(coupon.value),
    min_order_value: Math.max(0, Number(coupon.min_order_value || 0)),
    expires_at: normalizedExpiresAt ? normalizedExpiresAt : null,
    active: Boolean(coupon.active),
    allow_on_sale: Boolean(coupon.allow_on_sale),
  };
}

function notifyStoreChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORE_EVENT));
  }
}

export function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(initialData);
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    const products = Array.isArray(parsed.products)
      ? parsed.products.map((p) => ({
          ...p,
          listing_type: resolveListingType(p.listing_type, p.category, p.material),
        }))
      : structuredClone(initialData.products);
    const parsedAnnouncement = parsed.announcement as Partial<StoreSettings> | undefined;
    return {
      ...initialData,
      ...parsed,
      products,
      announcement: {
        ...initialData.announcement,
        ...parsedAnnouncement,
        promo_active:
          typeof parsedAnnouncement?.promo_active === "boolean"
            ? parsedAnnouncement.promo_active
            : DEFAULT_STORE_PROMOTION.promo_active,
        promo_badge:
          typeof parsedAnnouncement?.promo_badge === "string"
            ? parsedAnnouncement.promo_badge
            : DEFAULT_STORE_PROMOTION.promo_badge,
        promo_title:
          typeof parsedAnnouncement?.promo_title === "string"
            ? parsedAnnouncement.promo_title
            : DEFAULT_STORE_PROMOTION.promo_title,
        promo_description:
          typeof parsedAnnouncement?.promo_description === "string"
            ? parsedAnnouncement.promo_description
            : DEFAULT_STORE_PROMOTION.promo_description,
        promo_highlight:
          typeof parsedAnnouncement?.promo_highlight === "string"
            ? parsedAnnouncement.promo_highlight
            : DEFAULT_STORE_PROMOTION.promo_highlight,
        promo_cta_label: "",
        promo_cta_type: normalizePromoCtaType(parsedAnnouncement?.promo_cta_type),
      },
    };
  } catch {
    return structuredClone(initialData);
  }
}

export function saveStore(data: StoreData) {
  localStorage.setItem(KEY, JSON.stringify(data));
  notifyStoreChanged();
}

const STORE_SETTINGS_COLUMNS =
  "id, announcement_active, announcement_text, announcement_link, promo_active, promo_badge, promo_title, promo_description, promo_highlight, promo_cta_label, promo_cta_type";

function mapStoreSettingsRow(row: StoreSettingsRow, fallbackPromo?: PromoFields): StoreSettings {
  const promo: PromoFields = fallbackPromo ?? {
    promo_active: Boolean(row.promo_active ?? DEFAULT_STORE_PROMOTION.promo_active),
    promo_badge: row.promo_badge ?? DEFAULT_STORE_PROMOTION.promo_badge,
    promo_title: row.promo_title ?? DEFAULT_STORE_PROMOTION.promo_title,
    promo_description: row.promo_description ?? DEFAULT_STORE_PROMOTION.promo_description,
    promo_highlight: row.promo_highlight ?? DEFAULT_STORE_PROMOTION.promo_highlight,
    promo_cta_label: row.promo_cta_label ?? "",
    promo_cta_type: normalizePromoCtaType(row.promo_cta_type),
  };

  return {
    active: Boolean(row.announcement_active),
    text: row.announcement_text ?? "",
    link: row.announcement_link ?? "#vitrine",
    ...promo,
  };
}

export async function fetchStoreData(scope: StoreScope = "public"): Promise<StoreData> {
  if (!isSupabaseConfigured || !supabase) {
    return loadStore();
  }

  let productsQuery = supabase
    .from("products")
    .select(
      "id, name, sku, category, material, listing_type, price, sale_price, is_on_sale, sale_label, image_url, description, active, featured, in_stock, characteristics",
    )
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  let bannersQuery = supabase
    .from("hero_banners")
    .select("id, image_url, mobile_image_url, alt, active, filter, display_order")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  let couponsQuery = supabase
    .from("coupons")
    .select("id, code, type, value, min_order_value, expires_at, active, allow_on_sale")
    .order("created_at", { ascending: false });

  if (scope === "public") {
    productsQuery = productsQuery.eq("active", true);
    bannersQuery = bannersQuery.eq("active", true);
    couponsQuery = couponsQuery.eq("active", true);
  }

  const settingsQuery = supabase
    .from("store_settings")
    .select(STORE_SETTINGS_COLUMNS)
    .eq("id", 1)
    .maybeSingle();

  const [productsRes, bannersRes, couponsRes, settingsRes] = await Promise.all([
    productsQuery,
    bannersQuery,
    couponsQuery,
    settingsQuery,
  ]);

  let productRows = (productsRes.data ?? []) as ProductRow[];
  if (productsRes.error) {
    if (isMissingListingTypeColumnError(productsRes.error)) {
      let fallbackProductsQuery = supabase
        .from("products")
        .select(
          "id, name, sku, category, material, price, sale_price, is_on_sale, sale_label, image_url, description, active, featured, in_stock, characteristics",
        )
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });
      if (scope === "public") {
        fallbackProductsQuery = fallbackProductsQuery.eq("active", true);
      }
      const fallbackProductsRes = await fallbackProductsQuery;
      if (fallbackProductsRes.error) {
        throw new Error(`Erro ao carregar produtos: ${fallbackProductsRes.error.message}`);
      }
      productRows = (fallbackProductsRes.data ?? []) as ProductRow[];
    } else {
      throw new Error(`Erro ao carregar produtos: ${productsRes.error.message}`);
    }
  }
  let bannersRows = (bannersRes.data ?? []) as HeroBannerRow[];
  if (bannersRes.error) {
    if (
      bannersRes.error.code === "42703" ||
      bannersRes.error.message.includes("mobile_image_url")
    ) {
      let fallbackBannersQuery = supabase
        .from("hero_banners")
        .select("id, image_url, alt, active, filter, display_order")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (scope === "public") {
        fallbackBannersQuery = fallbackBannersQuery.eq("active", true);
      }
      const fallbackRes = await fallbackBannersQuery;
      if (fallbackRes.error) {
        throw new Error(`Erro ao carregar banners: ${fallbackRes.error.message}`);
      }
      bannersRows = (fallbackRes.data ?? []) as HeroBannerRow[];
    } else {
      throw new Error(`Erro ao carregar banners: ${bannersRes.error.message}`);
    }
  }
  if (couponsRes.error) {
    throw new Error(`Erro ao carregar cupons: ${couponsRes.error.message}`);
  }

  let settingsRow = settingsRes.data as StoreSettingsRow | null;
  let usedPromoFallback = false;
  if (settingsRes.error) {
    if (isMissingPromoColumnError(settingsRes.error)) {
      usedPromoFallback = true;
      const fallbackSettingsRes = await supabase
        .from("store_settings")
        .select("id, announcement_active, announcement_text, announcement_link")
        .eq("id", 1)
        .maybeSingle();
      if (fallbackSettingsRes.error) {
        throw new Error(`Erro ao carregar configurações: ${fallbackSettingsRes.error.message}`);
      }
      settingsRow = fallbackSettingsRes.data as StoreSettingsRow | null;
    } else {
      throw new Error(`Erro ao carregar configurações: ${settingsRes.error.message}`);
    }
  }

  const announcement: StoreSettings = settingsRow
    ? mapStoreSettingsRow(settingsRow, usedPromoFallback ? readLocalPromoFallback() : undefined)
    : { ...emptyStoreData.announcement, ...readLocalPromoFallback() };

  let profile: AdminProfile = { ...emptyStoreData.profile };
  if (scope === "admin") {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (user) {
      const profileRes = await supabase
        .from("admin_profiles")
        .select("id, name, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profileRes.error) {
        throw new Error(`Erro ao carregar perfil: ${profileRes.error.message}`);
      }

      const row = profileRes.data as AdminProfileRow | null;
      profile = {
        name: row?.name?.trim() || "Administradora",
        email: row?.email?.trim() || user.email || "",
        avatar: row?.avatar_url ?? "",
      };
    }
  }

  return {
    products: productRows.map(mapProductRow),
    banners: bannersRows.map(mapBannerRow),
    coupons: ((couponsRes.data ?? []) as CouponRow[]).map(mapCouponRow),
    announcement,
    profile,
  };
}

function isImageStillReferenced(
  imageUrl: string,
  state: StoreData,
  exclude?: { kind: "products" | "banners"; id: string },
): boolean {
  if (!imageUrl) return false;
  const usedInProducts = state.products.some(
    (p) => p.image_url === imageUrl && !(exclude?.kind === "products" && p.id === exclude.id),
  );
  if (usedInProducts) return true;
  const usedInBanners = state.banners.some(
    (b) =>
      (b.image_url === imageUrl || (b.mobile_image_url ?? "") === imageUrl) &&
      !(exclude?.kind === "banners" && b.id === exclude.id),
  );
  if (usedInBanners) return true;
  return state.profile.avatar === imageUrl;
}

export async function upsertProduct(product: Product, previousImageUrl?: string): Promise<Product> {
  const client = requireSupabase();
  const payload = toProductPayload(product);
  const { data, error } = await client
    .from("products")
    .upsert(payload, { onConflict: "id" })
    .select(
      "id, name, sku, category, material, listing_type, price, sale_price, is_on_sale, sale_label, image_url, description, active, featured, in_stock, characteristics",
    )
    .single();

  if (error && isMissingListingTypeColumnError(error)) {
    const { listing_type: requestedListingType, ...legacyPayload } = payload;
    const fallback = await client
      .from("products")
      .upsert(legacyPayload, { onConflict: "id" })
      .select(
        "id, name, sku, category, material, price, sale_price, is_on_sale, sale_label, image_url, description, active, featured, in_stock, characteristics",
      )
      .single();

    if (fallback.error || !fallback.data) {
      throw new Error(`Erro ao salvar produto: ${fallback.error?.message ?? "resposta vazia"}`);
    }

    if (previousImageUrl && previousImageUrl !== payload.image_url) {
      await deleteStoreImage(previousImageUrl);
    }

    const mapped = mapProductRow(fallback.data as ProductRow);
    return { ...mapped, listing_type: requestedListingType };
  }

  if (error || !data) {
    throw new Error(`Erro ao salvar produto: ${error?.message ?? "resposta vazia"}`);
  }

  if (previousImageUrl && previousImageUrl !== payload.image_url) {
    await deleteStoreImage(previousImageUrl);
  }

  return mapProductRow(data as ProductRow);
}

export async function removeProduct(id: string, imageUrlToClean?: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("products").delete().eq("id", id);
  if (error) {
    throw new Error(`Erro ao excluir produto: ${error.message}`);
  }
  if (imageUrlToClean) {
    await deleteStoreImage(imageUrlToClean);
  }
}

export async function upsertBanner(
  banner: Banner,
  displayOrder: number,
  previousImageUrls: string[] = [],
): Promise<Banner> {
  const client = requireSupabase();
  const payload = toBannerPayload(banner, displayOrder);
  const { data, error } = await client
    .from("hero_banners")
    .upsert(payload, { onConflict: "id" })
    .select("id, image_url, mobile_image_url, alt, active, filter, display_order")
    .single();

  if (error || !data) {
    throw new Error(`Erro ao salvar banner: ${error?.message ?? "resposta vazia"}`);
  }

  const kept = new Set([payload.image_url, payload.mobile_image_url ?? ""]);
  for (const prevUrl of previousImageUrls) {
    if (prevUrl && !kept.has(prevUrl)) {
      await deleteStoreImage(prevUrl);
    }
  }

  return mapBannerRow(data as HeroBannerRow, displayOrder);
}

export async function saveBannersOrder(banners: Banner[]): Promise<Banner[]> {
  const client = requireSupabase();
  const payloads = banners.map((banner, index) => toBannerPayload(banner, index));
  const { data, error } = await client
    .from("hero_banners")
    .upsert(payloads, { onConflict: "id" })
    .select("id, image_url, mobile_image_url, alt, active, filter, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Erro ao reordenar banners: ${error.message}`);
  }

  return ((data ?? []) as HeroBannerRow[]).map(mapBannerRow);
}

export async function removeBanner(id: string, imageUrlsToClean: string[] = []): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("hero_banners").delete().eq("id", id);
  if (error) {
    throw new Error(`Erro ao excluir banner: ${error.message}`);
  }
  for (const url of imageUrlsToClean) {
    if (url) {
      await deleteStoreImage(url);
    }
  }
}

export async function saveStoreAnnouncement(
  announcement: StoreSettings,
): Promise<StoreSettings> {
  const client = requireSupabase();
  const basePayload = {
    id: 1,
    announcement_active: Boolean(announcement.active),
    announcement_text: announcement.text.trim(),
    announcement_link: announcement.link.trim() || "#vitrine",
  };
  const promoPayload: PromoFields = {
    promo_active: Boolean(announcement.promo_active),
    promo_badge: announcement.promo_badge.trim(),
    promo_title: announcement.promo_title.trim(),
    promo_description: announcement.promo_description.trim(),
    promo_highlight: announcement.promo_highlight.trim(),
    promo_cta_label: "",
    promo_cta_type: "vitrine",
  };

  const { data, error } = await client
    .from("store_settings")
    .upsert({ ...basePayload, ...promoPayload }, { onConflict: "id" })
    .select(STORE_SETTINGS_COLUMNS)
    .single();

  if (error && isMissingPromoColumnError(error)) {
    writeLocalPromoFallback(promoPayload);
    const fallback = await client
      .from("store_settings")
      .upsert(basePayload, { onConflict: "id" })
      .select("id, announcement_active, announcement_text, announcement_link")
      .single();

    if (fallback.error || !fallback.data) {
      throw new Error(
        `Erro ao salvar configurações da loja: ${fallback.error?.message ?? "resposta vazia"}`,
      );
    }

    return mapStoreSettingsRow(fallback.data as StoreSettingsRow, promoPayload);
  }

  if (error || !data) {
    throw new Error(`Erro ao salvar configurações da loja: ${error?.message ?? "resposta vazia"}`);
  }

  const mapped = mapStoreSettingsRow(data as StoreSettingsRow);
  writeLocalPromoFallback({
    promo_active: mapped.promo_active,
    promo_badge: mapped.promo_badge,
    promo_title: mapped.promo_title,
    promo_description: mapped.promo_description,
    promo_highlight: mapped.promo_highlight,
    promo_cta_label: "",
    promo_cta_type: "vitrine",
  });
  return mapped;
}

export async function upsertCoupon(coupon: Coupon): Promise<Coupon> {
  const client = requireSupabase();
  const payload = toCouponPayload(coupon);
  const { data, error } = await client
    .from("coupons")
    .upsert(payload, { onConflict: "id" })
    .select("id, code, type, value, min_order_value, expires_at, active, allow_on_sale")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("Já existe um cupom cadastrado com este código.");
    }
    throw new Error(`Erro ao salvar cupom: ${error?.message ?? "resposta vazia"}`);
  }

  return mapCouponRow(data as CouponRow);
}

export async function removeCoupon(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("coupons").delete().eq("id", id);
  if (error) {
    throw new Error(`Erro ao excluir cupom: ${error.message}`);
  }
}

export async function saveAdminProfile(
  profile: AdminProfile,
  previousAvatarUrl?: string,
): Promise<AdminProfile> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const payload = {
    id: userData.user.id,
    name: profile.name.trim() || "Administradora",
    email: profile.email.trim() || userData.user.email || "",
    avatar_url: profile.avatar.trim(),
  };

  const { data, error } = await client
    .from("admin_profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id, name, email, avatar_url")
    .single();

  if (error || !data) {
    throw new Error(`Erro ao salvar perfil: ${error?.message ?? "resposta vazia"}`);
  }

  if (previousAvatarUrl && previousAvatarUrl !== payload.avatar_url) {
    await deleteStoreImage(previousAvatarUrl);
  }

  const row = data as AdminProfileRow;
  return {
    name: row.name ?? "Administradora",
    email: row.email ?? "",
    avatar: row.avatar_url ?? "",
  };
}

export function useStore(options?: { scope?: StoreScope; enabled?: boolean }) {
  const scope = options?.scope ?? "public";
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<StoreData>(() =>
    isSupabaseConfigured ? emptyStoreData : initialData,
  );
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured && enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (!isSupabaseConfigured) {
      setData(loadStore());
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const remoteData = await fetchStoreData(scope);
      setData(remoteData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados da loja.");
    } finally {
      setLoading(false);
    }
  }, [scope, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onStoreEvent = () => {
      void refresh();
    };
    window.addEventListener(STORE_EVENT, onStoreEvent);
    if (!isSupabaseConfigured) {
      window.addEventListener("storage", onStoreEvent);
    }
    return () => {
      window.removeEventListener(STORE_EVENT, onStoreEvent);
      if (!isSupabaseConfigured) {
        window.removeEventListener("storage", onStoreEvent);
      }
    };
  }, [refresh, enabled]);

  const update = useCallback((next: StoreData) => {
    if (!isSupabaseConfigured) {
      saveStore(next);
    }
    setData(next);
  }, []);

  const saveProduct = useCallback(
    async (product: Product) => {
      const existing = data.products.find((p) => p.id === product.id);
      if (!isSupabaseConfigured) {
        const next: StoreData = {
          ...data,
          products: existing
            ? data.products.map((p) => (p.id === product.id ? product : p))
            : [...data.products, product],
        };
        saveStore(next);
        setData(next);
        return;
      }

      const oldUrl =
        existing?.image_url &&
        existing.image_url !== product.image_url &&
        !isImageStillReferenced(existing.image_url, data, { kind: "products", id: existing.id })
          ? existing.image_url
          : undefined;

      const saved = await upsertProduct(product, oldUrl);
      setData((prev) => ({
        ...prev,
        products: prev.products.some((p) => p.id === saved.id)
          ? prev.products.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev.products],
      }));
      notifyStoreChanged();
    },
    [data],
  );

  const toggleProductField = useCallback(
    async (product: Product, key: "active" | "featured" | "in_stock") => {
      await saveProduct({ ...product, [key]: !product[key] });
    },
    [saveProduct],
  );

  const duplicateProduct = useCallback(
    async (product: Product) => {
      const copy: Product = {
        ...structuredClone(product),
        id: crypto.randomUUID(),
        name: `${product.name} (cópia)`,
        sku: "",
        active: false,
      };
      await saveProduct(copy);
    },
    [saveProduct],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const existing = data.products.find((p) => p.id === id);
      if (!isSupabaseConfigured) {
        const next: StoreData = {
          ...data,
          products: data.products.filter((p) => p.id !== id),
        };
        saveStore(next);
        setData(next);
        return;
      }

      const cleanUrl =
        existing?.image_url &&
        !isImageStillReferenced(existing.image_url, data, { kind: "products", id })
          ? existing.image_url
          : undefined;

      await removeProduct(id, cleanUrl);
      setData((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
      }));
      notifyStoreChanged();
    },
    [data],
  );

  const saveBanner = useCallback(
    async (banner: Banner) => {
      const existingIndex = data.banners.findIndex((b) => b.id === banner.id);
      const existing = existingIndex >= 0 ? data.banners[existingIndex] : undefined;
      const displayOrder =
        banner.display_order ?? (existingIndex >= 0 ? existingIndex : data.banners.length);

      if (!isSupabaseConfigured) {
        const bannerWithOrder: Banner = {
          ...banner,
          mobile_image_url: null,
          alt: DEFAULT_BANNER_ALT,
          display_order: displayOrder,
        };
        const next: StoreData = {
          ...data,
          banners: existing
            ? data.banners.map((b) => (b.id === banner.id ? bannerWithOrder : b))
            : [...data.banners, bannerWithOrder],
        };
        saveStore(next);
        setData(next);
        return;
      }

      const oldUrls: string[] = [];
      if (
        existing?.image_url &&
        existing.image_url !== banner.image_url &&
        !isImageStillReferenced(existing.image_url, data, { kind: "banners", id: existing.id })
      ) {
        oldUrls.push(existing.image_url);
      }
      if (
        existing?.mobile_image_url &&
        existing.mobile_image_url !== (banner.mobile_image_url ?? "") &&
        !isImageStillReferenced(existing.mobile_image_url, data, {
          kind: "banners",
          id: existing.id,
        })
      ) {
        oldUrls.push(existing.mobile_image_url);
      }

      const saved = await upsertBanner(banner, displayOrder, oldUrls);
      setData((prev) => ({
        ...prev,
        banners: prev.banners.some((b) => b.id === saved.id)
          ? prev.banners.map((b) => (b.id === saved.id ? saved : b))
          : [...prev.banners, saved],
      }));
      notifyStoreChanged();
    },
    [data],
  );

  const reorderBanners = useCallback(
    async (nextBanners: Banner[]) => {
      const ordered = nextBanners.map((b, index) => ({ ...b, display_order: index }));
      if (!isSupabaseConfigured) {
        const next: StoreData = { ...data, banners: ordered };
        saveStore(next);
        setData(next);
        return;
      }

      const saved = await saveBannersOrder(ordered);
      setData((prev) => ({ ...prev, banners: saved }));
      notifyStoreChanged();
    },
    [data],
  );

  const deleteBanner = useCallback(
    async (id: string) => {
      const existing = data.banners.find((b) => b.id === id);
      if (!isSupabaseConfigured) {
        const next: StoreData = {
          ...data,
          banners: data.banners.filter((b) => b.id !== id),
        };
        saveStore(next);
        setData(next);
        return;
      }

      const cleanUrls: string[] = [];
      if (
        existing?.image_url &&
        !isImageStillReferenced(existing.image_url, data, { kind: "banners", id })
      ) {
        cleanUrls.push(existing.image_url);
      }
      if (
        existing?.mobile_image_url &&
        !isImageStillReferenced(existing.mobile_image_url, data, { kind: "banners", id })
      ) {
        cleanUrls.push(existing.mobile_image_url);
      }

      await removeBanner(id, cleanUrls);
      setData((prev) => ({
        ...prev,
        banners: prev.banners.filter((b) => b.id !== id),
      }));
      notifyStoreChanged();
    },
    [data],
  );

  const saveAnnouncement = useCallback(
    async (announcement: StoreSettings) => {
      const normalized: StoreSettings = {
        ...announcement,
        promo_cta_label: "",
        promo_cta_type: "vitrine",
      };
      if (!isSupabaseConfigured) {
        const next: StoreData = { ...data, announcement: normalized };
        saveStore(next);
        setData(next);
        return;
      }

      const saved = await saveStoreAnnouncement(normalized);
      setData((prev) => ({ ...prev, announcement: saved }));
      notifyStoreChanged();
    },
    [data],
  );

  const saveCoupon = useCallback(
    async (coupon: Coupon) => {
      const normalized = { ...coupon, code: normalizeCode(coupon.code) };
      if (!isSupabaseConfigured) {
        const exists = data.coupons.some((c) => c.id === normalized.id);
        const next: StoreData = {
          ...data,
          coupons: exists
            ? data.coupons.map((c) => (c.id === normalized.id ? normalized : c))
            : [...data.coupons, normalized],
        };
        saveStore(next);
        setData(next);
        return;
      }

      const saved = await upsertCoupon(normalized);
      setData((prev) => ({
        ...prev,
        coupons: prev.coupons.some((c) => c.id === saved.id)
          ? prev.coupons.map((c) => (c.id === saved.id ? saved : c))
          : [saved, ...prev.coupons],
      }));
      notifyStoreChanged();
    },
    [data],
  );

  const deleteCoupon = useCallback(
    async (id: string) => {
      if (!isSupabaseConfigured) {
        const next: StoreData = {
          ...data,
          coupons: data.coupons.filter((c) => c.id !== id),
        };
        saveStore(next);
        setData(next);
        return;
      }

      await removeCoupon(id);
      setData((prev) => ({
        ...prev,
        coupons: prev.coupons.filter((c) => c.id !== id),
      }));
      notifyStoreChanged();
    },
    [data],
  );

  const saveProfile = useCallback(
    async (profile: AdminProfile) => {
      if (!isSupabaseConfigured) {
        const next: StoreData = { ...data, profile };
        saveStore(next);
        setData(next);
        return;
      }

      const oldAvatar =
        data.profile.avatar && data.profile.avatar !== profile.avatar
          ? data.profile.avatar
          : undefined;

      const saved = await saveAdminProfile(profile, oldAvatar);
      setData((prev) => ({ ...prev, profile: saved }));
      notifyStoreChanged();
    },
    [data],
  );

  return {
    data,
    loading,
    error,
    isRemote: isSupabaseConfigured,
    refresh,
    update,
    saveProduct,
    toggleProductField,
    duplicateProduct,
    deleteProduct,
    saveBanner,
    reorderBanners,
    deleteBanner,
    saveAnnouncement,
    saveCoupon,
    deleteCoupon,
    saveProfile,
  };
}
