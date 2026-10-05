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
        t("hero_badge", "Small badge above headline", "সারা বাংলাদেশে ক্যাশ অন ডেলিভারি"),
        t("hero_headline", "Headline", "স্মার্ট শপিং করুন {store} এ"),
        area("hero_sub", "Sub headline", "বাছাই করা পণ্য, সঠিক দাম আর ঘরে বসে ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন।"),
        t("hero_cta", "Primary button text", "কেনাকাটা করুন"),
        t("hero_cta2", "Secondary button text", "WhatsApp এ অর্ডার করুন"),
        img("hero_image", "Hero image", "Leave empty to use your top product image."),
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
      description: "Product page settings.",
      fields: [
        t("pdp_trust1", "Trust line 1", ""),
        t("pdp_trust2", "Trust line 2", ""),
        t("pdp_trust3", "Trust line 3", ""),
        t("pdp_urgency", "Urgency line", ""),
        area("pdp_returns", "Return / warranty note", ""),
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
const THEME_GROUP: Partial<Record<StoreThemeId, ContentGroup>> = {
  aurora: {
    id: "theme-aurora",
    title: "Aurora highlights",
    description: "Trust highlights and the offer chip on the gradient hero.",
    fields: [
      t("aurora_stat1", "Highlight 1 (next to hero buttons)", "10k+ orders delivered"),
      t("aurora_stat2", "Highlight 2 (next to hero buttons)", "4.8★ average rating"),
    ],
  },
  bazaar: {
    id: "theme-bazaar",
    title: "Bazaar deal strip",
    description: "Colored deal strip shown between the hero and the product sections.",
    fields: [
      t("bazaar_deal_title", "Flash deal strip title", "আজকের ডিল"),
      t("bazaar_deal_note", "Flash deal note", "স্টক সীমিত — আগে অর্ডার করলেই পাবেন"),
    ],
  },
  atelier: {
    id: "theme-atelier",
    title: "সহজ শপ — অর্ডার ও কল",
    description: "কল করে অর্ডারের লেখা, অর্ডার বাটনের লেখা আর রিটার্ন পলিসি।",
    fields: [
      t("sohoj_call_label", "কল করার উপরের ছোট লেখা", "অর্ডার করতে কল করুন"),
      t("sohoj_order_label", "অর্ডার বাটনের লেখা", "অর্ডার করুন"),
      t("sohoj_free_label", "ফ্রি ডেলিভারি বাটনের লেখা", "ফ্রী ডেলিভারিতে অর্ডার করুন"),
      t("sohoj_free_note", "ফ্রি ডেলিভারির নোটিশ", "এই পণ্যটি পাচ্ছেন সম্পূর্ণ ফ্রি ডেলিভারিতে!"),
      area(
        "sohoj_return",
        "রিটার্ন পলিসি",
        "পণ্য হাতে পাওয়ার ২৪ ঘণ্টার মধ্যে সমস্যা জানালে রিটার্ন বা রিপ্লেসমেন্ট করা হবে। ডেলিভারি ম্যানের সামনেই পণ্য চেক করে নিন।",
      ),
    ],
  },
  poripati: {
    id: "theme-poripati",
    title: "পরিপাটি — editorial details",
    description: "Banner kicker, collection note and the focused story band.",
    fields: [
      t("poripati_kicker", "Banner kicker", "Thoughtfully selected for everyday life"),
      t("poripati_collection", "Collection label", "The current edit"),
      area("poripati_story", "Story band", "Useful things, clearly presented — so choosing feels simple."),
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
