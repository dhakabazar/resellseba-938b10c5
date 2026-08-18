import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Menu, Phone, Search, ShoppingBag, X } from "lucide-react";
import { menuTarget, type MenuNode } from "@/lib/store-menu";

import { useStore } from "./store-context";
import { borderc, cx, Heading, muted } from "./ui";

function Logo() {
  const { code, name, settings, theme } = useStore();
  return (
    <Link to="/s/$code" params={{ code }} className="flex min-w-0 items-center gap-2.5">
      {settings?.logo_url ? (
        <img src={settings.logo_url} alt={name} className="h-10 w-auto max-w-[150px] object-contain" />
      ) : (
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] text-base font-bold text-[var(--st-on-primary)]"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <Heading as="h1" className={cx("truncate text-base leading-tight", theme.layout.header === "editorial" && "text-lg")}>
          {name}
        </Heading>
        {settings?.tagline && <span className={cx("block truncate text-[11px]", muted)}>{settings.tagline}</span>}
      </span>
    </Link>
  );
}

function SearchBox({ className }: { className?: string }) {
  const { code } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        nav({ to: "/s/$code", params: { code }, search: { q: q || undefined } });
      }}
      className={cx("relative", className)}
    >
      <Search className={cx("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", muted)} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className={cx(
          "w-full rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--st-fg)] outline-none placeholder:text-[var(--st-muted)] focus:border-[var(--st-primary)]",
          borderc,
        )}
      />
    </form>
  );
}

function CartButton() {
  const { code, cartCount } = useStore();
  return (
    <Link
      to="/s/$code/checkout"
      params={{ code }}
      aria-label="Cart"
      className={cx(
        "relative inline-flex items-center gap-2 rounded-[var(--st-radius-sm)] border px-3 py-2 text-sm",
        borderc,
        "hover:border-[var(--st-primary)]",
      )}
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Cart</span>
      {cartCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--st-primary)] px-1 text-[10px] font-bold text-[var(--st-on-primary)]">
          {cartCount}
        </span>
      )}
    </Link>
  );
}

/** Renders one menu row as a router link / external anchor / plain span. */
function MenuLabel({
  node,
  className,
  onClick,
  children,
}: {
  node: MenuNode;
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const { code } = useStore();
  const target = menuTarget(node, code);
  const body = children ?? node.label;
  if (target.kind === "route")
    return (
      <Link to={target.to} params={target.params} className={className} onClick={onClick}>
        {body}
      </Link>
    );
  if (target.kind === "route-slug")
    return (
      <Link to={target.to} params={target.params} className={className} onClick={onClick}>
        {body}
      </Link>
    );
  if (target.kind === "external")
    return (
      <a
        href={target.href}
        target={node.open_new_tab ? "_blank" : undefined}
        rel={node.open_new_tab ? "noreferrer" : undefined}
        className={className}
        onClick={onClick}
      >
        {body}
      </a>
    );
  return <span className={className}>{body}</span>;
}

function MenuPanel({ node }: { node: MenuNode }) {
  const mega = node.layout === "mega";
  return (
    <div
      className={cx(
        "invisible absolute left-0 top-full z-50 translate-y-1 opacity-0 transition-all duration-150",
        "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 focus-within:visible focus-within:opacity-100",
      )}
    >
      <div
        className={cx(
          "mt-1 rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] p-2 shadow-xl",
          borderc,
          mega ? "grid w-[min(92vw,760px)] grid-cols-2 gap-4 p-3 md:grid-cols-3" : "w-60",
        )}
      >
        {node.children.map((child) => (
          <div key={child.id} className={mega ? "min-w-0" : "group/sub relative min-w-0"}>
            <MenuLabel
              node={child}
              className={cx(
                "flex items-center gap-2 rounded-[var(--st-radius-sm)] px-2 py-1.5 text-sm font-medium hover:bg-[var(--st-bg-alt)] hover:text-[var(--st-primary)]",
              )}
            >
              {mega && child.image_url && (
                <img
                  src={child.image_url}
                  alt={child.label}
                  className="h-10 w-10 shrink-0 rounded-[var(--st-radius-sm)] object-cover"
                />
              )}
              {!mega && child.image_url && (
                <img src={child.image_url} alt={child.label} className="h-7 w-7 shrink-0 rounded object-cover" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{child.label}</span>
                {mega && child.description && (
                  <span className={cx("block truncate text-[11px]", muted)}>{child.description}</span>
                )}
              </span>
              {!mega && child.children.length > 0 && (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 opacity-70" />
              )}
            </MenuLabel>

            {child.children.length > 0 &&
              (mega ? (
                <div className="mt-1 flex flex-col gap-0.5 pl-2">
                  {child.children.map((leaf) => (
                    <MenuLabel
                      key={leaf.id}
                      node={leaf}
                      className={cx("truncate rounded px-2 py-1 text-[12px] hover:text-[var(--st-primary)]", muted)}
                    />
                  ))}
                </div>
              ) : (
                /* Third level opens as a side flyout on hover / focus. */
                <div
                  className={cx(
                    "invisible absolute left-full top-0 z-50 -translate-x-1 pl-1 opacity-0 transition-all duration-150",
                    "group-hover/sub:visible group-hover/sub:translate-x-0 group-hover/sub:opacity-100",
                    "focus-within:visible focus-within:opacity-100",
                  )}
                >
                  <div
                    className={cx(
                      "flex w-56 flex-col gap-0.5 rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] p-2 shadow-xl",
                      borderc,
                    )}
                  >
                    {child.children.map((leaf) => (
                      <MenuLabel
                        key={leaf.id}
                        node={leaf}
                        className={cx(
                          "truncate rounded-[var(--st-radius-sm)] px-2 py-1.5 text-[13px] hover:bg-[var(--st-bg-alt)] hover:text-[var(--st-primary)]",
                          muted,
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}


function StoreNav({ variant }: { variant: "row" | "stack" }) {
  const { code, categories, menu, theme } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [openChildId, setOpenChildId] = useState<string | null>(null);

  /** No custom menu yet -> keep the automatic category list. */
  const items: MenuNode[] = menu.length
    ? menu
    : [
        {
          id: "__all",
          label: "All products",
          kind: "all_products" as const,
          parent_id: null,
          ref_slug: null,
          url: null,
          image_url: null,
          description: null,
          open_new_tab: false,
          layout: "dropdown" as const,
          sort_order: 0,
          is_active: true,
          children: [],
        },
        ...categories.map((c, i) => ({
          id: c.id,
          label: c.name,
          kind: "category" as const,
          parent_id: null,
          ref_slug: c.slug,
          url: null,
          image_url: c.image_url,
          description: null,
          open_new_tab: false,
          layout: "dropdown" as const,
          sort_order: i + 1,
          is_active: true,
          children: [] as MenuNode[],
        })),
      ];

  if (!items.length) return null;
  void code;

  const style = theme.layout.nav;
  const base = cx(
    "text-sm transition-colors",
    theme.layout.uppercaseNav && "text-xs uppercase tracking-[0.14em]",
  );
  const shape =
    style === "chips"
      ? "rounded-full border border-[var(--st-border)] px-3.5 py-1.5 hover:border-[var(--st-primary)] hover:text-[var(--st-primary)]"
      : style === "pills"
        ? "px-3 py-1.5 hover:text-[var(--st-primary)]"
        : style === "tabs"
          ? "border-b-2 border-transparent px-1 py-2.5 hover:border-[var(--st-primary)] hover:text-[var(--st-primary)]"
          : "hover:text-[var(--st-primary)]";

  if (variant === "stack") {
    return (
      <nav className="flex flex-col gap-1">
        {items.map((node) => (
          <div key={node.id}>
            <div className="flex items-center gap-1">
              <MenuLabel node={node} className={cx(base, "flex-1 py-2")} />
              {node.children.length > 0 && (
                <button
                  type="button"
                  aria-label={`Toggle ${node.label}`}
                  onClick={() => setOpenId((v) => (v === node.id ? null : node.id))}
                  className="rounded p-1.5 hover:bg-[var(--st-bg-alt)]"
                >
                  <ChevronDown
                    className={cx("h-4 w-4 transition-transform", openId === node.id && "rotate-180")}
                  />
                </button>
              )}
            </div>
            {openId === node.id && (
              <div className={cx("ml-3 border-l pl-3", borderc)}>
                {node.children.map((child) => (
                  <div key={child.id}>
                    <div className="flex items-center gap-1">
                      <MenuLabel node={child} className={cx("block flex-1 py-1.5 text-sm", muted)}>
                        <span className="flex items-center gap-2">
                          {child.image_url && (
                            <img src={child.image_url} alt={child.label} className="h-7 w-7 rounded object-cover" />
                          )}
                          {child.label}
                        </span>
                      </MenuLabel>
                      {child.children.length > 0 && (
                        <button
                          type="button"
                          aria-label={`Toggle ${child.label}`}
                          onClick={() => setOpenChildId((v) => (v === child.id ? null : child.id))}
                          className="rounded p-1.5 hover:bg-[var(--st-bg-alt)]"
                        >
                          <ChevronDown
                            className={cx("h-3.5 w-3.5 transition-transform", openChildId === child.id && "rotate-180")}
                          />
                        </button>
                      )}
                    </div>
                    {openChildId === child.id &&
                      child.children.map((leaf) => (
                        <MenuLabel key={leaf.id} node={leaf} className={cx("block py-1 pl-4 text-[12px]", muted)} />
                      ))}
                  </div>
                ))}
              </div>
            )}

          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="relative flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
      {items.map((node) => (
        <div key={node.id} className="group relative">
          <MenuLabel node={node} className={cx(base, shape, "inline-flex items-center gap-1")}>
            <span className="whitespace-nowrap">{node.label}</span>
            {node.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
          </MenuLabel>
          {node.children.length > 0 && <MenuPanel node={node} />}
        </div>
      ))}
    </nav>
  );
}

const CategoryNav = StoreNav;


export function StoreHeader() {
  const { settings, theme } = useStore();
  const [open, setOpen] = useState(false);
  const v = theme.layout.header;

  const announcement = settings?.announcement?.trim();

  return (
    <div className="sticky top-0 z-40">
      {announcement && (
        <div className="bg-[var(--st-primary)] px-4 py-1.5 text-center text-[12px] font-medium text-[var(--st-on-primary)]">
          {announcement}
        </div>
      )}

      {v === "bar" ? (
        <div className="bg-[var(--st-surface)]">
          <div className="bg-[var(--st-primary)]">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
              <div className="rounded-[var(--st-radius-sm)] bg-[var(--st-surface)] px-2 py-1">
                <Logo />
              </div>
              <SearchBox className="hidden flex-1 md:block" />
              <div className="ml-auto flex items-center gap-2 text-[var(--st-on-primary)]">
                {settings?.support_phone && (
                  <a href={`tel:${settings.support_phone}`} className="hidden items-center gap-1.5 text-sm sm:flex">
                    <Phone className="h-4 w-4" /> {settings.support_phone}
                  </a>
                )}
                <div className="rounded-[var(--st-radius-sm)] bg-[var(--st-surface)] text-[var(--st-fg)]">
                  <CartButton />
                </div>
              </div>
            </div>
          </div>
          <div className={cx("border-b", borderc)}>
            <div className="mx-auto max-w-6xl px-4">
              <CategoryNav variant="row" />
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 py-2 md:hidden">
            <SearchBox />
          </div>
        </div>
      ) : v === "classic" ? (
        <header className={cx("border-b bg-[var(--st-bg)]/95 backdrop-blur", borderc)}>
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4">
            <div className="flex w-full items-center justify-between gap-3">
              <button className="md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="mx-auto md:mx-0">
                <Logo />
              </div>
              <div className="flex items-center gap-2">
                <SearchBox className="hidden w-64 lg:block" />
                <CartButton />
              </div>
            </div>
            <div className="hidden md:block">
              <CategoryNav variant="row" />
            </div>
          </div>
          {open && (
            <div className={cx("border-t px-4 py-3 md:hidden", borderc)}>
              <SearchBox className="mb-3" />
              <CategoryNav variant="stack" />
            </div>
          )}
        </header>
      ) : v === "editorial" ? (
        <header className={cx("border-b bg-[var(--st-bg)]", borderc)}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
            <Logo />
            <div className="hidden md:block">
              <CategoryNav variant="row" />
            </div>
            <div className="flex items-center gap-2">
              <SearchBox className="hidden w-56 lg:block" />
              <CartButton />
              <button className="md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {open && (
            <div className={cx("border-t px-5 py-4 md:hidden", borderc)}>
              <SearchBox className="mb-3" />
              <CategoryNav variant="stack" />
            </div>
          )}
        </header>
      ) : (
        <header className={cx("border-b bg-[var(--st-bg)]/80 backdrop-blur-xl", borderc)}>
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <Logo />
            <SearchBox className="mx-auto hidden max-w-md flex-1 md:block" />
            <div className="ml-auto flex items-center gap-2">
              <CartButton />
              <button className="md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className={cx("mx-auto hidden max-w-6xl px-4 pb-3 md:block")}>
            <CategoryNav variant="row" />
          </div>
          {open && (
            <div className={cx("border-t px-4 py-3 md:hidden", borderc)}>
              <SearchBox className="mb-3" />
              <CategoryNav variant="stack" />
            </div>
          )}
        </header>
      )}
    </div>
  );
}

export function TrustBar() {
  const { theme, content } = useStore();
  if (!theme.layout.trustBar || !content.flag("usp_show")) return null;
  const items = [1, 2, 3, 4]
    .map((i) => ({ t: content.text(`usp${i}_t`), d: content.text(`usp${i}_d`) }))
    .filter((i) => i.t);
  if (!items.length) return null;

  return (
    <section className={cx("border-y bg-[var(--st-bg-alt)]", borderc)}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-5 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.t}>
            <div className="text-sm font-semibold text-[var(--st-fg)]">{i.t}</div>
            <div className={cx("text-xs", muted)}>{i.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StoreFooter() {
  const { code, name, settings, categories } = useStore();
  const year = new Date().getFullYear();
  const socials = [
    settings?.facebook_url && { label: "Facebook", href: settings.facebook_url },
    settings?.instagram_url && { label: "Instagram", href: settings.instagram_url },
    settings?.tiktok_url && { label: "TikTok", href: settings.tiktok_url },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer className={cx("mt-16 border-t bg-[var(--st-bg-alt)]", borderc)}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Heading className="text-lg">{name}</Heading>
          <p className={cx("mt-2 max-w-md text-sm leading-relaxed", muted)}>
            {settings?.about_text ||
              settings?.meta_description ||
              `${name} — genuine products, honest pricing and cash-on-delivery across Bangladesh.`}
          </p>
          {socials.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className={cx("rounded-[var(--st-radius-sm)] border px-3 py-1.5 text-xs hover:border-[var(--st-primary)]", borderc)}
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--st-fg)]">Shop</div>
          <div className="flex flex-col gap-2">
            <Link to="/s/$code" params={{ code }} className={cx("text-sm hover:text-[var(--st-primary)]", muted)}>
              All products
            </Link>
            {categories.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to="/s/$code/c/$slug"
                params={{ code, slug: c.slug }}
                className={cx("text-sm hover:text-[var(--st-primary)]", muted)}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--st-fg)]">Support</div>
          <div className={cx("flex flex-col gap-2 text-sm", muted)}>
            {settings?.support_phone && <a href={`tel:${settings.support_phone}`}>Call {settings.support_phone}</a>}
            {settings?.whatsapp && (
              <a href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">
                WhatsApp chat
              </a>
            )}
            <span>Cash on delivery available</span>
            <span>Delivery: 1–3 days (Dhaka), 2–5 days (outside)</span>
          </div>
        </div>
      </div>
      <div className={cx("border-t px-4 py-5 text-center text-xs", borderc, muted)}>
        {settings?.footer_text || `© ${year} ${name}. All rights reserved.`}
      </div>
    </footer>
  );
}
