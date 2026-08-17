import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "./store-context";
import { borderc, cx, GhostButton, Heading, muted, PrimaryButton, SectionHead } from "./ui";

/* ------------------------------------------------------------------ helpers */

function whatsappHref(n?: string | null) {
  return n ? `https://wa.me/${n.replace(/[^\d]/g, "")}` : undefined;
}

function useHeroMedia() {
  const { content, listings, image } = useStore();
  const custom = content.text("hero_image");
  const spotlight = listings[0];
  return custom || (spotlight ? image(spotlight) : undefined);
}

/* --------------------------------------------------------------------- hero */

export function Hero() {
  const store = useStore();
  const { code, theme, content, settings, listings, name } = store;
  const media = useHeroMedia();
  const firstSlug = listings[0]?.product?.slug;
  const wa = whatsappHref(settings?.whatsapp);
  if (!content.flag("hero_show")) return null;

  const badge = content.text("hero_badge");
  const headline = content.text("hero_headline");
  const sub = content.text("hero_sub");
  const cta = content.text("hero_cta");
  const cta2 = content.text("hero_cta2");
  const note = content.text("hero_note");

  const buttons = (
    <div className="flex flex-wrap items-center gap-3">
      {firstSlug ? (
        <Link to="/s/$code/p/$slug" params={{ code, slug: firstSlug }}>
          <PrimaryButton>
            {cta} <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </Link>
      ) : null}
      {wa && cta2 ? (
        <a href={wa} target="_blank" rel="noreferrer">
          <GhostButton>{cta2}</GhostButton>
        </a>
      ) : null}
    </div>
  );

  if (theme.layout.hero === "banner")
    return (
      <section className="mx-auto max-w-6xl px-4 pt-4">
        <div className={cx("overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)]", borderc)}>
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="p-6 md:p-10">
              {badge && (
                <span className="inline-block rounded-full bg-[var(--st-primary)]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--st-primary)]">
                  {badge}
                </span>
              )}
              <Heading as="h2" className="mt-3 text-2xl leading-tight md:text-4xl">
                {headline}
              </Heading>
              <p className={cx("mt-3 max-w-md text-sm", muted)}>{sub}</p>
              <div className="mt-5">{buttons}</div>
              {note && <p className={cx("mt-3 text-xs", muted)}>{note}</p>}
            </div>
            <div className="min-h-[220px] bg-[var(--st-bg-alt)]">
              {media && <img src={media} alt={name} className="h-full w-full object-cover" />}
            </div>
          </div>
        </div>
      </section>
    );

  if (theme.layout.hero === "spotlight")
    return (
      <section className="relative overflow-hidden">
        {media && <img src={media} alt={name} className="absolute inset-0 h-full w-full object-cover opacity-35" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-[var(--st-bg)]/70 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center md:py-32">
          {badge && <span className="text-[11px] uppercase tracking-[0.4em] text-[var(--st-primary)]">{badge}</span>}
          <Heading as="h2" className="mt-4 text-4xl leading-[1.1] md:text-6xl">
            {headline}
          </Heading>
          <p className={cx("mx-auto mt-5 max-w-xl text-sm md:text-base", muted)}>{sub}</p>
          <div className="mt-8 flex justify-center">{buttons}</div>
          {note && <p className={cx("mt-4 text-xs", muted)}>{note}</p>}
        </div>
      </section>
    );

  if (theme.layout.hero === "split")
    return (
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          {badge && <span className="text-[11px] uppercase tracking-[0.3em] text-[var(--st-muted)]">{badge}</span>}
          <Heading as="h2" className="mt-4 text-4xl leading-[1.05] md:text-6xl">
            {headline}
          </Heading>
          <p className={cx("mt-5 max-w-md text-base leading-relaxed", muted)}>{sub}</p>
          <div className="mt-8">{buttons}</div>
          {note && <p className={cx("mt-3 text-xs", muted)}>{note}</p>}
        </div>
        <div className="aspect-[4/5] overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-alt)]">
          {media && <img src={media} alt={name} className="h-full w-full object-cover" />}
        </div>
      </section>
    );

  /* Aurora — gradient hero with product card, stats and offer chip */
  const stat1 = content.text("aurora_stat1");
  const stat2 = content.text("aurora_stat2");
  const offer = content.text("aurora_offer");

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          background:
            "radial-gradient(1000px 420px at 12% -10%, var(--st-primary), transparent 60%), radial-gradient(820px 420px at 92% 0%, var(--st-accent), transparent 62%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
        <div>
          {badge && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--st-border)] bg-[var(--st-surface)] px-3 py-1.5 text-[11px] font-medium shadow-[var(--st-shadow)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--st-primary)]" /> {badge}
            </span>
          )}
          <Heading as="h2" className="mt-4 text-3xl leading-[1.12] md:text-5xl">
            {headline}
          </Heading>
          <p className={cx("mt-4 max-w-md text-sm md:text-base", muted)}>{sub}</p>
          <div className="mt-7">{buttons}</div>
          {note && <p className={cx("mt-3 text-xs", muted)}>{note}</p>}
          {(stat1 || stat2) && (
            <div className="mt-7 flex flex-wrap items-center gap-6">
              {[stat1, stat2].filter(Boolean).map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm font-medium">
                  <BadgeCheck className="h-4 w-4 text-[var(--st-primary)]" /> {s}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-surface)] shadow-[var(--st-shadow)]">
            <div className="aspect-[4/3] bg-[var(--st-bg-alt)]">
              {media && <img src={media} alt={name} className="h-full w-full object-cover" />}
            </div>
          </div>
          {offer && (
            <span className="absolute -bottom-3 left-4 rounded-full bg-[var(--st-primary)] px-4 py-2 text-xs font-semibold text-[var(--st-on-primary)] shadow-[var(--st-shadow)]">
              {offer}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- benefit strip */

export function BenefitStrip() {
  const { content } = useStore();
  if (!content.flag("usp_show")) return null;
  const icons = [Truck, ShieldCheck, BadgeCheck, Undo2];
  const items = [1, 2, 3, 4]
    .map((i, n) => ({
      t: content.text(`usp${i}_t`),
      d: content.text(`usp${i}_d`),
      Icon: icons[n],
    }))
    .filter((i) => i.t);
  if (!items.length) return null;

  return (
    <section className={cx("border-y bg-[var(--st-bg-alt)]", borderc)}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 md:grid-cols-4">
        {items.map(({ t, d, Icon }) => (
          <div key={t} className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--st-primary)]/12 text-[var(--st-primary)]">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--st-fg)]">{t}</div>
              {d && <div className={cx("text-xs", muted)}>{d}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- categories */

export function CategoryStrip() {
  const { code, categories, content, theme } = useStore();
  if (!content.flag("cat_show") || !categories.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <SectionHead title={content.text("cat_title")} subtitle={content.text("cat_sub")} />
      <div
        className={cx(
          "grid gap-4",
          theme.layout.grid === "dense"
            ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        )}
      >
        {categories.map((c) => (
          <Link
            key={c.id}
            to="/s/$code/c/$slug"
            params={{ code, slug: c.slug }}
            className={cx(
              "group overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)] transition-all hover:-translate-y-0.5 hover:border-[var(--st-primary)]",
              borderc,
            )}
          >
            <div className="aspect-[4/3] bg-[var(--st-bg-alt)]">
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className={cx("grid h-full w-full place-items-center text-2xl font-semibold", muted)}>
                  {c.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-sm font-medium">
              {c.name}
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ promo banner */

export function PromoBanner() {
  const { code, content, settings } = useStore();
  if (!content.flag("promo_show")) return null;
  const title = content.text("promo_title");
  const text = content.text("promo_text");
  const cta = content.text("promo_cta");
  const image = content.text("promo_image");
  if (!title && !text) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div
        className={cx(
          "grid overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)] md:grid-cols-[1.2fr_1fr]",
          borderc,
        )}
      >
        <div className="relative p-6 md:p-9">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              background: "radial-gradient(600px 240px at 0% 0%, var(--st-primary), transparent 60%)",
            }}
          />
          <div className="relative">
            <Heading className="text-xl md:text-2xl">{title}</Heading>
            <p className={cx("mt-2 max-w-md text-sm leading-relaxed", muted)}>{text}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {cta && (
                <Link to="/s/$code" params={{ code }}>
                  <PrimaryButton>{cta}</PrimaryButton>
                </Link>
              )}
              {settings?.support_phone && (
                <a href={`tel:${settings.support_phone}`}>
                  <GhostButton>Call {settings.support_phone}</GhostButton>
                </a>
              )}
            </div>
          </div>
        </div>
        {image && (
          <div className="min-h-[180px] bg-[var(--st-bg-alt)]">
            <img src={image} alt={title} loading="lazy" className="h-full w-full object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ why us */

export function WhyUs() {
  const { content } = useStore();
  if (!content.flag("why_show")) return null;
  const items = [1, 2, 3].map((i) => ({ t: content.text(`why${i}_t`), d: content.text(`why${i}_d`) })).filter((i) => i.t);
  if (!items.length) return null;
  return (
    <section className={cx("border-y bg-[var(--st-bg-alt)]", borderc)}>
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionHead title={content.text("why_title")} />
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((i, n) => (
            <div
              key={i.t}
              className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-5", borderc)}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--st-primary)] text-sm font-bold text-[var(--st-on-primary)]">
                {n + 1}
              </span>
              <div className="mt-3 text-base font-semibold text-[var(--st-fg)]">{i.t}</div>
              <p className={cx("mt-1.5 text-sm leading-relaxed", muted)}>{i.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- reviews */

export function Reviews() {
  const { content } = useStore();
  if (!content.flag("review_show")) return null;
  const items = [1, 2, 3]
    .map((i) => ({ text: content.text(`review${i}_text`), name: content.text(`review${i}_name`) }))
    .filter((i) => i.text);
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <SectionHead title={content.text("review_title")} />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <figure
            key={i.name + i.text}
            className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-5", borderc)}
          >
            <div className="flex items-center gap-1 text-[var(--st-primary)]">
              {[0, 1, 2, 3, 4].map((s) => (
                <Star key={s} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <Quote className={cx("mt-3 h-4 w-4", muted)} />
            <blockquote className="mt-2 text-sm leading-relaxed text-[var(--st-fg)]">{i.text}</blockquote>
            {i.name && <figcaption className={cx("mt-3 text-xs font-medium", muted)}>{i.name}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- faq */

export function Faq() {
  const { content } = useStore();
  const [open, setOpen] = useState(0);
  if (!content.flag("faq_show")) return null;
  const items = [1, 2, 3].map((i) => ({ q: content.text(`faq${i}_q`), a: content.text(`faq${i}_a`) })).filter((i) => i.q);
  if (!items.length) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };

  return (
    <section className={cx("border-t bg-[var(--st-bg-alt)]", borderc)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <SectionHead title={content.text("faq_title")} />
        <div className={cx("divide-y overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)]", borderc)}>
          {items.map((i, n) => (
            <div key={i.q}>
              <button
                onClick={() => setOpen(open === n ? -1 : n)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium"
              >
                {i.q}
                <ChevronDown className={cx("h-4 w-4 transition-transform", open === n && "rotate-180")} />
              </button>
              {open === n && <p className={cx("px-4 pb-4 text-sm leading-relaxed", muted)}>{i.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------- theme signature section */

/**
 * Renders the active theme's own content fields, so every field shown in the
 * panel has a matching place on the storefront.
 */
export function ThemeSignature({ slot = "mid" }: { slot?: "top" | "mid" }) {
  const { theme, content } = useStore();

  if (theme.id === "bazaar" && slot === "top") {
    const title = content.text("bazaar_deal_title");
    const note = content.text("bazaar_deal_note");
    if (!title && !note) return null;
    return (
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--st-radius)] bg-[var(--st-primary)] px-4 py-3 text-[var(--st-on-primary)]">
          <div className="flex items-center gap-2 text-sm font-bold uppercase">
            <Sparkles className="h-4 w-4" /> {title}
          </div>
          {note && <div className="text-xs font-medium opacity-90">{note}</div>}
        </div>
      </section>
    );
  }

  if (slot === "top") return null;

  if (theme.id === "noir") {
    const eyebrow = content.text("noir_eyebrow");
    const story = content.text("noir_story");
    if (!eyebrow && !story) return null;
    return (
      <section className={cx("border-y bg-[var(--st-bg-alt)]", borderc)}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          {eyebrow && (
            <span className="text-[11px] uppercase tracking-[0.4em] text-[var(--st-primary)]">{eyebrow}</span>
          )}
          {story && (
            <Heading as="h2" className="mt-5 text-2xl leading-snug md:text-3xl">
              {story}
            </Heading>
          )}
        </div>
      </section>
    );
  }

  if (theme.id === "atelier") {
    const quote = content.text("atelier_quote");
    const credit = content.text("atelier_credit");
    if (!quote) return null;
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Heading as="h2" className="text-3xl leading-tight md:text-5xl">
          {quote}
        </Heading>
        {credit && <p className={cx("mt-4 text-xs uppercase tracking-[0.3em]", muted)}>{credit}</p>}
      </section>
    );
  }

  return null;
}
