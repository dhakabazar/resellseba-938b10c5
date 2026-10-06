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

  const headline = content.text("hero_headline");
  const sub = content.text("hero_sub");
  const cta = content.text("hero_cta");
  const cta2 = content.text("hero_cta2");

  const buttons = (
    <div className="flex items-center gap-2 sm:gap-3">
      {firstSlug ? (
        <Link to={store.url(`/p/${firstSlug}`)} className="flex-1 sm:flex-initial">
          <PrimaryButton className="w-full sm:w-auto px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm whitespace-nowrap">
            {cta} <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          </PrimaryButton>
        </Link>
      ) : null}
      {wa && cta2 ? (
        <a href={wa} target="_blank" rel="noreferrer" className="flex-1 sm:flex-initial">
          <GhostButton className="w-full sm:w-auto px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm whitespace-nowrap">
            {cta2}
          </GhostButton>
        </a>
      ) : null}
    </div>
  );

  /* Bazaar & সহজ শপ — শুধু পিওর ব্যানার ইমেজ, কোনো টেক্সট বা বাটন কখনোই থাকবে না */
  if (theme.layout.hero === "banner" || theme.layout.hero === "sohoj" || theme.id === "bazaar") {
    if (!media) return null;
    return (
      <section className="mx-auto max-w-6xl px-3 pt-3 sm:px-4 sm:pt-4">
        <div className={cx("overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)]", borderc)}>
          {firstSlug ? (
            <Link to={store.url(`/p/${firstSlug}`)} className="block">
              <img
                src={media}
                alt={name}
                loading="eager"
                className="block h-auto w-full max-w-full object-contain"
              />
            </Link>
          ) : (
            <img
              src={media}
              alt={name}
              loading="eager"
              className="block h-auto w-full max-w-full object-contain"
            />
          )}
        </div>
      </section>
    );
  }

  if (theme.layout.hero === "spotlight")
    return (
      <section className="relative overflow-hidden">
        {media && <img src={media} alt={name} className="absolute inset-0 h-full w-full object-cover opacity-35" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-[var(--st-bg)]/70 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center md:py-32">
          <Heading as="h2" className="text-4xl leading-[1.1] md:text-6xl">
            {headline}
          </Heading>
          <p className={cx("mx-auto mt-5 max-w-xl text-sm md:text-base", muted)}>{sub}</p>
          <div className="mt-8 flex justify-center">{buttons}</div>
        </div>
      </section>
    );

  if (theme.layout.hero === "split")
    return (
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <Heading as="h2" className="text-4xl leading-[1.05] md:text-6xl">
            {headline}
          </Heading>
          <p className={cx("mt-5 max-w-md text-base leading-relaxed", muted)}>{sub}</p>
          <div className="mt-8">{buttons}</div>
        </div>
        <div className="aspect-[5/4] overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-alt)]">
          {media && <img src={media} alt={name} className="h-full w-full object-cover" />}
        </div>
      </section>
    );

  /* Aurora — gradient hero with product card and stats */
  const stat1 = content.text("aurora_stat1");
  const stat2 = content.text("aurora_stat2");

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          background:
            "radial-gradient(1000px 420px at 12% -10%, var(--st-primary), transparent 60%), radial-gradient(820px 420px at 92% 0%, var(--st-accent), transparent 62%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 py-6 sm:py-10 md:grid-cols-2 md:gap-10 md:py-20">
        <div>
          <Heading as="h2" className="text-2xl font-extrabold leading-tight sm:text-3xl md:text-5xl">
            {headline}
          </Heading>
          <p className={cx("mt-2.5 max-w-md text-xs sm:text-sm md:text-base leading-relaxed sm:mt-4", muted)}>{sub}</p>
          <div className="mt-4 sm:mt-6">{buttons}</div>
          {(stat1 || stat2) && (
            <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-6">
              {[stat1, stat2].filter(Boolean).map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
                  <BadgeCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[var(--st-primary)] shrink-0" /> {s}
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
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- benefit strip */

export function BenefitStrip() {
  const { content, theme } = useStore();
  if (!content.flag("usp_show")) return null;
  const icons = [Truck, ShieldCheck, BadgeCheck, Undo2];
  const items = [1, 2, 3, 4]
    .map((i, n) => ({ t: content.text(`usp${i}_t`), d: content.text(`usp${i}_d`), Icon: icons[n] }))
    .filter((i) => i.t);
  if (!items.length) return null;

  /* Bazaar — flat colored service bar, marketplace style */
  if (theme.id === "bazaar")
    return (
      <section className="bg-[var(--st-primary)] text-[var(--st-on-primary)]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 md:grid-cols-4">
          {items.map(({ t, d, Icon }) => (
            <div key={t} className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-bold uppercase">{t}</div>
                {d && <div className="truncate text-[11px] opacity-85">{d}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    );

  /* Noir — hairline divided 2-column on mobile, 4-column on desktop */
  if (theme.id === "noir")
    return (
      <section className={cx("border-y", borderc)}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
          {items.map(({ t, d }, idx) => (
            <div
              key={t}
              className={cx(
                "p-3.5 text-center sm:px-5 sm:py-6",
                idx % 2 === 0 && "border-r",
                idx >= 2 && "border-t md:border-t-0",
                idx > 0 && "md:border-l md:border-r-0",
                borderc,
              )}
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--st-fg)] sm:text-[12px] sm:tracking-[0.22em]">
                {t}
              </div>
              {d && <div className={cx("mt-1 text-[11px] leading-relaxed sm:text-xs", muted)}>{d}</div>}
            </div>
          ))}
        </div>
      </section>
    );

  /* সহজ শপ — কমলা সার্ভিস বার (সেকশনের সমান প্রস্থ) */
  if (theme.id === "atelier")
    return (
      <section className="mx-auto max-w-6xl px-4 pt-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--st-radius)] bg-[var(--st-primary)] px-4 py-3 text-[var(--st-on-primary)] shadow-[var(--st-shadow)] md:grid-cols-4">
          {items.map(({ t, d, Icon }) => (
            <div key={t} className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-bold">{t}</div>
                {d && <div className="truncate text-[11px] opacity-85">{d}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    );


  /* Aurora — glass cards with gradient icon pills */
  return (
    <section className="mx-auto mt-4 max-w-6xl px-4 sm:-mt-6">
      <div
        className={cx(
          "grid grid-cols-2 gap-3 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4 shadow-[var(--st-shadow)] md:grid-cols-4",
          borderc,
        )}
      >
        {items.map(({ t, d, Icon }) => (
          <div key={t} className="flex items-start gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--st-on-primary)]"
              style={{ background: "linear-gradient(135deg, var(--st-primary), var(--st-accent))" }}
            >
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
  const { code, categories, content, theme, url } = useStore();
  if (!content.flag("cat_show") || !categories.length) return null;
  const title = content.text("cat_title");

  /* Bazaar — round icon rail, scrollable like a marketplace */
  if (theme.id === "bazaar")
    return (
      <section className="mx-auto max-w-6xl px-4 py-6">
        <SectionHead title={title} />
        <div className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-3", borderc)}>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={url(`/c/${c.slug}`)}
                className="group flex flex-col items-center gap-1.5 text-center"
              >
                <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[var(--st-bg-alt)] ring-2 ring-transparent transition-all group-hover:ring-[var(--st-primary)]">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-[var(--st-primary)]">{c.name.charAt(0)}</span>
                  )}
                </span>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-[var(--st-fg)]">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );

  /* Noir — compact, softly squared category tiles */
  if (theme.id === "noir")
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionHead title={title} />
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={url(`/c/${c.slug}`)}
              className={cx(
                "group overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)] transition-colors hover:border-[var(--st-primary)]",
                borderc,
              )}
            >
              <div className="aspect-square overflow-hidden bg-[var(--st-bg-alt)]">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100" />
                ) : (
                  <div className="grid h-full place-items-center text-lg text-[var(--st-primary)]">{c.name.charAt(0)}</div>
                )}
              </div>
              <div className="px-1.5 py-2 text-center">
                <span className="block truncate text-[11px] font-medium text-[var(--st-fg)]">{c.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );

  /* সহজ শপ — সাদা বর্ডার বক্সে ক্যাটাগরির নাম */
  if (theme.id === "atelier")
    return (
      <section className="mx-auto max-w-6xl px-3 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.slice(0, 10).map((c) => (
            <Link
              key={c.id}
              to={url(`/c/${c.slug}`)}
              className={cx(
                "flex items-center justify-center gap-2 rounded-[var(--st-radius)] border bg-[var(--st-surface)] px-3 py-3.5 text-center text-[13px] font-semibold transition-colors hover:border-[var(--st-primary)] hover:text-[var(--st-primary)]",
                borderc,
              )}
            >
              <span className="line-clamp-1">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>
    );


  /* Aurora — compact circular category portraits */
  return (
    <section className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      <SectionHead title={title} />
      <div className="grid grid-cols-4 gap-x-2.5 gap-y-3 sm:grid-cols-6 sm:gap-x-4 sm:gap-y-4 lg:grid-cols-8">
        {categories.map((c) => (
          <Link
            key={c.id}
            to={url(`/c/${c.slug}`)}
            className="group flex min-w-0 flex-col items-center text-center"
          >
            <div className="aspect-square w-full overflow-hidden rounded-full border-2 border-[var(--st-surface)] bg-[var(--st-bg-alt)] shadow-[var(--st-shadow)] ring-1 ring-[var(--st-border)] transition-all group-hover:-translate-y-0.5 group-hover:ring-[var(--st-primary)]">
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className={cx("grid h-full w-full place-items-center text-lg font-semibold", muted)}>
                  {c.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="mt-1.5 w-full px-0.5">
              <span className="block truncate text-[11px] font-semibold leading-tight text-[var(--st-fg)] sm:text-xs">{c.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ promo banner */

export function PromoBanner() {
  const { code, content, settings, theme, url } = useStore();
  if (!content.flag("promo_show")) return null;
  const title = content.text("promo_title");
  const text = content.text("promo_text");
  const cta = content.text("promo_cta");
  const image = content.text("promo_image");
  if (!title && !text) return null;

  const shopLink = (label: string, primary = true) => (
    <Link to={url("/")}>
      {primary ? <PrimaryButton>{label}</PrimaryButton> : <GhostButton>{label}</GhostButton>}
    </Link>
  );

  /* Bazaar — loud full-width offer band */
  if (theme.id === "bazaar")
    return (
      <section className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex flex-col items-center gap-3 rounded-[var(--st-radius)] bg-[var(--st-accent)] px-5 py-5 text-center text-[var(--st-on-accent)] md:flex-row md:text-left">
          {image && <img src={image} alt={title} loading="lazy" className="h-20 w-20 rounded-lg object-cover" />}
          <div className="flex-1">
            <div className="text-lg font-extrabold uppercase">{title}</div>
            <p className="mt-1 text-sm opacity-90">{text}</p>
          </div>
          {cta && (
            <Link
              to={url("/")}
              className="rounded-full bg-[var(--st-primary)] px-6 py-2.5 text-sm font-bold text-[var(--st-on-primary)]"
            >
              {cta}
            </Link>
          )}
        </div>
      </section>
    );

  /* Noir — cinematic image with centered copy */
  if (theme.id === "noir")
    return (
      <section className="relative overflow-hidden">
        {image && <img src={image} alt={title} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="absolute inset-0 bg-[var(--st-bg)]/60" />
        <div className="relative mx-auto max-w-2xl px-4 py-20 text-center">
          <Heading className="text-2xl leading-snug md:text-4xl">{title}</Heading>
          <p className={cx("mt-4 text-sm leading-relaxed", muted)}>{text}</p>
          <div className="mt-7 flex justify-center">{cta && shopLink(cta)}</div>
        </div>
      </section>
    );

  /* সহজ শপ — ছবির অফার ব্যানার / কমলা অফার বার */
  if (theme.id === "atelier")
    return (
      <section className="mx-auto max-w-6xl px-3 py-4">
        {image ? (
          <Link to={url("/")} className={cx("block overflow-hidden rounded-[var(--st-radius)] border", borderc)}>
            <img src={image} alt={title} loading="lazy" className="h-auto w-full object-cover" />
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-[var(--st-radius)] bg-[var(--st-primary)] px-5 py-5 text-center text-[var(--st-on-primary)] md:flex-row md:text-left">
            <div className="flex-1">
              <div className="text-lg font-extrabold">{title}</div>
              <p className="mt-1 text-sm opacity-90">{text}</p>
            </div>
            {cta && (
              <Link
                to={url("/")}
                className="rounded-[var(--st-radius)] bg-[var(--st-surface)] px-5 py-2.5 text-sm font-bold text-[var(--st-primary)]"
              >
                {cta}
              </Link>
            )}
          </div>
        )}
      </section>
    );


  /* Aurora — glowing gradient card */
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div
        className={cx(
          "grid overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-surface)] shadow-[var(--st-shadow)] md:grid-cols-[1.2fr_1fr]",
        )}
      >
        <div className="relative p-6 md:p-9">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{ background: "radial-gradient(600px 260px at 0% 0%, var(--st-primary), transparent 62%)" }}
          />
          <div className="relative">
            <Heading className="text-xl md:text-2xl">{title}</Heading>
            <p className={cx("mt-2 max-w-md text-sm leading-relaxed", muted)}>{text}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {cta && shopLink(cta)}
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
  return null;
}

/* ----------------------------------------------------------------- reviews */

export function Reviews() {
  const { content, theme } = useStore();
  if (!content.flag("review_show")) return null;
  const items = [1, 2, 3]
    .map((i) => ({ text: content.text(`review${i}_text`), name: content.text(`review${i}_name`) }))
    .filter((i) => i.text);
  if (!items.length) return null;
  const title = content.text("review_title");
  const stars = (cls = "h-3.5 w-3.5") => (
    <div className="flex items-center gap-0.5 text-[var(--st-primary)]">
      {[0, 1, 2, 3, 4].map((s) => (
        <Star key={s} className={cx(cls, "fill-current")} />
      ))}
    </div>
  );

  /* Bazaar — rating summary + compact review chips */
  if (theme.id === "bazaar")
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionHead title={title} />
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <div className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4 text-center", borderc)}>
            <div className="text-4xl font-extrabold text-[var(--st-primary)]">4.9</div>
            <div className="mt-1 flex justify-center">{stars()}</div>
            <div className={cx("mt-1 text-[11px]", muted)}>Verified buyers</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {items.map((i) => (
              <figure key={i.name + i.text} className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-3.5", borderc)}>
                {stars("h-3 w-3")}
                <blockquote className="mt-2 text-[12px] leading-relaxed text-[var(--st-fg)]">{i.text}</blockquote>
                {i.name && <figcaption className={cx("mt-2 text-[11px] font-semibold", muted)}>— {i.name}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      </section>
    );

  /* Noir — review grid, centered quote cards */
  if (theme.id === "noir")
    return (
      <section className={cx("border-y bg-[var(--st-bg-alt)]", borderc)}>
        <div className="mx-auto max-w-6xl px-4 py-20">
          <SectionHead title={title} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <figure key={i.name + i.text} className="flex flex-col items-center border bg-[var(--st-surface)] p-8 text-center">
                <Quote className="h-5 w-5 text-[var(--st-primary)]" />
                <blockquote>
                  <Heading as="h3" className="mt-5 text-base leading-relaxed md:text-lg">
                    “{i.text}”
                  </Heading>
                </blockquote>
                {i.name && (
                  <figcaption className={cx("mt-5 text-[10px] uppercase tracking-[0.32em]", muted)}>{i.name}</figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      </section>
    );

  /* সহজ শপ — সাদা রিভিউ কার্ড, তারা সহ */
  if (theme.id === "atelier")
    return (
      <section className="mx-auto max-w-6xl px-3 py-6">
        <SectionHead title={title} />
        <div className="grid gap-3 md:grid-cols-3">
          {items.map((i) => (
            <figure key={i.name + i.text} className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4", borderc)}>
              {stars()}
              <blockquote className="mt-2 text-[13px] leading-relaxed text-[var(--st-fg)]">{i.text}</blockquote>
              {i.name && <figcaption className={cx("mt-2 text-[12px] font-semibold", muted)}>— {i.name}</figcaption>}
            </figure>
          ))}
        </div>
      </section>
    );


  /* Aurora — soft shadow cards */
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <SectionHead title={title} />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <figure key={i.name + i.text} className="rounded-[var(--st-radius)] bg-[var(--st-surface)] p-5 shadow-[var(--st-shadow)]">
            {stars()}
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
  return null;
}

/* ------------------------------------------------- theme signature section */

/**
 * Renders the active theme's own content fields, so every field shown in the
 * panel has a matching place on the storefront.
 */
export function ThemeSignature({ slot = "mid" }: { slot?: "top" | "mid" }) {
  const { theme, content, settings } = useStore();

  if (slot === "top") return null;



  /* সহজ শপ — কল করে অর্ডারের বার */
  if (theme.id === "atelier") {
    const phone = settings?.support_phone?.trim();
    if (!phone) return null;
    return (
      <section className="mx-auto max-w-6xl px-3 py-3">
        <a
          href={`tel:${phone}`}
          className="flex flex-wrap items-center justify-center gap-2 rounded-[var(--st-radius)] bg-[var(--st-accent)] px-4 py-3 text-center text-sm font-extrabold text-[var(--st-on-accent)]"
        >
          {content.text("sohoj_call_label") || "অর্ডার করতে কল করুন"} — {phone}
        </a>
      </section>
    );
  }


  return null;
}
