/**
 * Per-theme storefront content.
 *
 * Every theme has the same content contract (so switching theme never loses
 * data) plus a few theme-specific extras. Values live in
 * `reseller_settings.theme_settings` as `{ [themeId]: { key: value } }`, so each
 * theme keeps its own copy of headlines / toggles / images.
 *
 * Nothing here is hardcoded on the storefront: components always read through
 * `resolveContent()`, which falls back to legacy columns and then to defaults.
 */

import type { StoreThemeId } from "./store-theme";

export type ContentFieldType = "text" | "textarea" | "image" | "toggle";

export type ContentField = {
  key: string;
  label: string;
  type: ContentFieldType;
  placeholder?: string;
  hint?: string;
  /** default value used when the reseller left it empty ({store} = store name) */
  def?: string | boolean;
};

export type ContentGroup = {
  id: string;
  title: string;
  description: string;
  fields: ContentField[];
};

export type ThemeContentValues = Record<string, string | boolean>;

const t = (key: string, label: string, def?: string, placeholder?: string): ContentField => ({
  key,
  label,
  type: "text",
  def,
  placeholder,
});
const area = (key: string, label: string, def?: string): ContentField => ({
  key,
  label,
  type: "textarea",
  def,
});
const img = (key: string, label: string, hint?: string): ContentField => ({
  key,
  label,
  type: "image",
  hint,
});
const on = (key: string, label: string, def = true): ContentField => ({
  key,
  label,
  type: "toggle",
  def,
});

/** Groups shared by every theme. */
function baseGroups(): ContentGroup[] {
  return [
    {
      id: "hero",
      title: "Hero section",
      description: "First screen customers see — the strongest conversion spot.",
      fields: [
        on("hero_show", "Show hero banner", true),
        t("hero_badge", "Small badge above headline", "Cash on delivery all over Bangladesh"),
        t("hero_headline", "Headline", "Shop smart at {store}"),
        area("hero_sub", "Sub headline", "Handpicked products, honest prices and delivery to your door. Pay only when you receive."),
        t("hero_cta", "Primary button text", "Shop now"),
        t("hero_cta2", "Secondary button text", "Order on WhatsApp"),
        img("hero_image", "Hero image", "Leave empty to use your top product image."),
        t("hero_note", "Small note under buttons", "Delivery in 1–3 days • Easy return within 24h"),
      ],
    },
    {
      id: "usp",
      title: "Benefit strip",
      description: "Four short promises right under the hero. Builds instant trust.",
      fields: [
        on("usp_show", "Show benefit strip"),
        t("usp1_t", "Benefit 1 title", "Cash on Delivery"),
        t("usp1_d", "Benefit 1 detail", "Pay after you receive"),
        t("usp2_t", "Benefit 2 title", "Nationwide delivery"),
        t("usp2_d", "Benefit 2 detail", "All 64 districts"),
        t("usp3_t", "Benefit 3 title", "100% genuine"),
        t("usp3_d", "Benefit 3 detail", "Verified products only"),
        t("usp4_t", "Benefit 4 title", "Easy returns"),
        t("usp4_d", "Benefit 4 detail", "Report within 24 hours"),
      ],
    },
    {
      id: "sections",
      title: "Home sections",
      description: "Titles and visibility of the product sections.",
      fields: [
        on("cat_show", "Show category section"),
        t("cat_title", "Category section title", "Shop by category"),
        t("cat_sub", "Category section subtitle", "Find what you need faster"),
        on("featured_show", "Show featured section"),
        t("featured_title", "Featured section title", "Best sellers"),
        t("featured_sub", "Featured section subtitle", "Most ordered products this month"),
        t("latest_title", "New arrivals title", "New arrivals"),
        t("latest_sub", "New arrivals subtitle", "Freshly added to the store"),
      ],
    },
    {
      id: "promo",
      title: "Promo banner",
      description: "Offer strip between sections — great for discounts or bundles.",
      fields: [
        on("promo_show", "Show promo banner", true),
        t("promo_title", "Promo title", "Order today, pay on delivery"),
        area("promo_text", "Promo text", "No advance payment needed. Confirm your order and pay the courier when the parcel reaches you."),
        t("promo_cta", "Promo button text", "Browse products"),
        img("promo_image", "Promo image"),
      ],
    },
    {
      id: "why",
      title: "Why shop with us",
      description: "Three reasons that remove buying hesitation.",
      fields: [
        on("why_show", "Show this section", true),
        t("why_title", "Section title", "Why customers choose {store}"),
        t("why1_t", "Reason 1", "Real product, real photos"),
        area("why1_d", "Reason 1 detail", "Every item is checked before it leaves our warehouse."),
        t("why2_t", "Reason 2", "Fast, tracked delivery"),
        area("why2_d", "Reason 2 detail", "Courier tracking is shared right after your order is booked."),
        t("why3_t", "Reason 3", "Support that replies"),
        area("why3_d", "Reason 3 detail", "Call or WhatsApp us any day between 10am and 9pm."),
      ],
    },
    {
      id: "reviews",
      title: "Customer reviews",
      description: "Social proof. Use real customer feedback.",
      fields: [
        on("review_show", "Show reviews", true),
        t("review_title", "Section title", "What customers say"),
        area("review1_text", "Review 1", "Product exactly matched the photos and delivery was quick. Highly recommended."),
        t("review1_name", "Review 1 name", "Rakib, Dhaka"),
        area("review2_text", "Review 2", "I paid after checking the parcel. Very comfortable shopping experience."),
        t("review2_name", "Review 2 name", "Sumaiya, Chattogram"),
        area("review3_text", "Review 3", "Support answered on WhatsApp within minutes. Will order again."),
        t("review3_name", "Review 3 name", "Tanvir, Sylhet"),
      ],
    },
    {
      id: "faq",
      title: "FAQ",
      description: "Answer the questions that stop people from ordering.",
      fields: [
        on("faq_show", "Show FAQ", true),
        t("faq_title", "Section title", "Frequently asked questions"),
        t("faq1_q", "Question 1", "How do I pay?"),
        area("faq1_a", "Answer 1", "Cash on delivery — you pay the courier when the parcel arrives."),
        t("faq2_q", "Question 2", "How long is delivery?"),
        area("faq2_a", "Answer 2", "1–3 days inside Dhaka and 2–5 days outside Dhaka."),
        t("faq3_q", "Question 3", "Can I return a product?"),
        area("faq3_a", "Answer 3", "Yes. If the product is wrong or damaged, report within 24 hours of delivery."),
      ],
    },
    {
      id: "product",
      title: "Product page",
      description: "Trust lines and urgency shown next to the buy button.",
      fields: [
        t("pdp_trust1", "Trust line 1", "Cash on delivery available"),
        t("pdp_trust2", "Trust line 2", "Genuine product guarantee"),
        t("pdp_trust3", "Trust line 3", "Delivery within 1–5 days"),
        t("pdp_urgency", "Urgency line", "Limited stock — order today to secure yours"),
        area("pdp_returns", "Return / warranty note", "Wrong or damaged item? Report within 24 hours for a free replacement."),
        on("pdp_sticky", "Show sticky mobile buy bar", true),
      ],
    },
    {
      id: "checkout",
      title: "Checkout page",
      description: "Copy that reassures customers on the final step.",
      fields: [
        t("co_headline", "Checkout headline", "Complete your order"),
        area("co_note", "Note above the form", "Fill in your delivery details. Our team will call to confirm before dispatch."),
        t("co_trust", "Trust line under the button", "No advance payment • Pay the courier on delivery"),
        t("co_success", "Thank-you headline", "Order received!"),
        area("co_success_note", "Thank-you note", "We will call you shortly to confirm the order and share courier tracking."),
      ],
    },
    {
      id: "footer",
      title: "Footer",
      description: "Closing message and store story in the footer.",
      fields: [
        area("footer_about", "About text in footer", ""),
        t("footer_note", "Bottom note", ""),
      ],
    },
  ];
}

/**
 * Theme-specific groups. Only the active theme's group is shown in the panel,
 * and every field here is rendered by that theme on the storefront.
 */
const THEME_GROUP: Record<StoreThemeId, ContentGroup> = {
  aurora: {
    id: "theme-aurora",
    title: "Aurora highlights",
    description: "Trust highlights and the offer chip on the gradient hero.",
    fields: [
      t("aurora_stat1", "Highlight 1 (next to hero buttons)", "10k+ orders delivered"),
      t("aurora_stat2", "Highlight 2 (next to hero buttons)", "4.8★ average rating"),
      t("aurora_offer", "Offer chip on hero image", "Free delivery over ৳2000"),
    ],
  },
  noir: {
    id: "theme-noir",
    title: "Noir brand story",
    description: "Eyebrow line above the hero headline and the boutique story band.",
    fields: [
      t("noir_eyebrow", "Collection eyebrow text", "The signature collection"),
      area("noir_story", "Brand story paragraph", "Curated pieces, made for people who notice the details."),
    ],
  },
  bazaar: {
    id: "theme-bazaar",
    title: "Bazaar deal strip",
    description: "Colored deal strip shown between the hero and the product sections.",
    fields: [
      t("bazaar_deal_title", "Flash deal strip title", "Today's deals"),
      t("bazaar_deal_note", "Flash deal note", "Limited stock — first come, first served"),
    ],
  },
  atelier: {
    id: "theme-atelier",
    title: "Atelier editorial quote",
    description: "Large editorial quote band placed between the product sections.",
    fields: [
      t("atelier_quote", "Editorial quote", "Fewer, better things."),
      t("atelier_credit", "Quote credit", "— our studio promise"),
    ],
  },
};

export function themeContentGroups(themeId: StoreThemeId): ContentGroup[] {
  const groups = baseGroups();
  const extra = THEME_GROUP[themeId];
  if (!extra) return groups;
  /** theme group sits right after the hero group */
  const i = groups.findIndex((g) => g.id === "hero");
  return [...groups.slice(0, i + 1), extra, ...groups.slice(i + 1)];
}

export function contentFieldMap(themeId: StoreThemeId): Record<string, ContentField> {
  const map: Record<string, ContentField> = {};
  for (const g of themeContentGroups(themeId)) for (const f of g.fields) map[f.key] = f;
  return map;
}

/** Legacy column fallbacks so existing stores keep their content. */
export type LegacyContent = {
  hero_headline?: string | null;
  hero_subheadline?: string | null;
  hero_image_url?: string | null;
  about_text?: string | null;
  footer_text?: string | null;
};

export type ContentReader = {
  text: (key: string) => string;
  flag: (key: string) => boolean;
};

export function createContentReader(
  themeId: StoreThemeId,
  values: ThemeContentValues | null | undefined,
  legacy: LegacyContent | null | undefined,
  storeName: string,
): ContentReader {
  const fields = contentFieldMap(themeId);
  const legacyMap: Record<string, string | null | undefined> = {
    hero_headline: legacy?.hero_headline,
    hero_sub: legacy?.hero_subheadline,
    hero_image: legacy?.hero_image_url,
    footer_about: legacy?.about_text,
    footer_note: legacy?.footer_text,
  };

  const fill = (s: string) => s.replace(/\{store\}/g, storeName);

  return {
    text: (key) => {
      const raw = values?.[key];
      if (typeof raw === "string" && raw.trim()) return fill(raw.trim());
      const lg = legacyMap[key];
      if (typeof lg === "string" && lg.trim()) return fill(lg.trim());
      const def = fields[key]?.def;
      return typeof def === "string" ? fill(def) : "";
    },
    flag: (key) => {
      const raw = values?.[key];
      if (typeof raw === "boolean") return raw;
      const def = fields[key]?.def;
      return typeof def === "boolean" ? def : true;
    },
  };
}
