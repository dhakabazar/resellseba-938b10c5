import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Menu, MessageCircle, Phone, Search, ShoppingBag, X } from "lucide-react";
import { menuTarget, type MenuNode } from "@/lib/store-menu";

import { useStore } from "./store-context";
import { borderc, cx, Heading, muted } from "./ui";

function Logo() {
  const { code, name, settings, theme, url } = useStore();
  return (
    <Link to={url("/")} className="flex min-w-0 items-center gap-2">
      {settings?.logo_url ? (
        <img src={settings.logo_url} alt={name} className="h-8 w-auto max-w-[120px] object-contain sm:h-10 sm:max-w-[180px]" />
      ) : (
        <>
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] text-sm font-bold text-[var(--st-on-primary)] sm:h-10 sm:w-10 sm:text-base"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 hidden xs:inline sm:inline">
            <Heading as="h1" className={cx("truncate text-sm font-bold leading-tight sm:text-base", theme.layout.header === "editorial" && "text-lg")}>
              {name}
            </Heading>
            {settings?.tagline && <span className={cx("block truncate text-[10px] sm:text-[11px]", muted)}>{settings.tagline}</span>}
          </span>
        </>
      )}
    </Link>
  );
}

function SearchBox({ className, variant = "default" }: { className?: string; variant?: "default" | "sohoj" }) {
  const { code, url } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    nav({ to: url("/"), search: { q: q || undefined } });
  };

  if (variant === "sohoj")
    return (
      <form onSubmit={submit} className={cx("relative", className)}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="পণ্য খুঁজুন…"
          aria-label="Search products"
          className={cx(
            "w-full rounded-[var(--st-radius)] border bg-[var(--st-surface)] py-2.5 pl-4 pr-14 text-sm text-[var(--st-fg)] outline-none placeholder:text-[var(--st-muted)] focus:border-[var(--st-primary)]",
            borderc,
          )}
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-0 top-0 grid h-full w-12 place-items-center rounded-r-[var(--st-radius)] bg-[var(--st-fg)] text-[var(--st-surface)]"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>
    );

  return (
    <form onSubmit={submit} className={cx("relative", className)}>
      <Search className={cx("pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 sm:left-3 sm:h-4 sm:w-4", muted)} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className={cx(
          "w-full rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] py-1.5 pl-8 pr-2.5 text-xs text-[var(--st-fg)] outline-none placeholder:text-[var(--st-muted)] focus:border-[var(--st-primary)] sm:py-2.5 sm:pl-9 sm:pr-3 sm:text-sm",
          borderc,
        )}
      />
    </form>
  );
}


function CartButton() {
  const { code, cartCount, url } = useStore();
  return (
    <Link
      to={url("/checkout")}
      aria-label="Cart"
      className={cx(
        "relative inline-flex items-center gap-1.5 rounded-[var(--st-radius-sm)] border p-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm",
        borderc,
        "hover:border-[var(--st-primary)]",
      )}
    >
      <ShoppingBag className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Cart</span>
      {cartCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--st-primary)] px-1 text-[9px] font-bold text-[var(--st-on-primary)] sm:h-5 sm:min-w-5 sm:text-[10px]">
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
        ...categories.slice(0, 5).map((c, i) => ({
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

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { code, name, settings, url } = useStore();
  const phone = settings?.support_phone?.trim();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className={cx("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")}>
      {/* halka dark backdrop */}
      <div
        className={cx(
          "absolute inset-0 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      {/* side drawer */}
      <aside
        className={cx(
          "absolute left-0 top-0 flex h-full w-[84%] max-w-xs flex-col bg-[var(--st-surface)] shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cx("flex items-center justify-between border-b px-4 py-3", borderc)}>
          <Link to={url("/")} onClick={onClose} className="flex min-w-0 items-center gap-2">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={name} className="h-8 w-auto max-w-[140px] object-contain" />
            ) : (
              <>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] text-sm font-bold text-[var(--st-on-primary)]">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-sm font-bold">{name}</span>
              </>
            )}
          </Link>
          <button aria-label="Close menu" onClick={onClose} className={cx("rounded-full p-1.5", muted)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) onClose();
          }}
        >
          <SearchBox className="mb-3" />
          {phone && (
            <a
              href={`tel:${phone}`}
              className="mb-3 flex items-center justify-center gap-2 rounded-[var(--st-radius)] bg-[var(--st-primary)] px-3 py-2.5 text-sm font-bold text-[var(--st-on-primary)]"
            >
              <Phone className="h-4 w-4" /> {phone}
            </a>
          )}
          <CategoryNav variant="stack" />
        </div>
      </aside>
    </div>,
    // portal inside the store root so the theme's --st-* variables still apply
    document.querySelector("[data-store-theme]") ?? document.body
  );
}


export function StoreHeader() {
  const { settings, theme, content } = useStore();
  const [open, setOpen] = useState(false);
  const v = theme.layout.header;

  const announcement = settings?.announcement?.trim();

  /* ------------------------- সহজ শপ: সাদা টপ বার + কমলা ক্যাটাগরি মেনু */
  if (v === "sohoj") {
    const phone = settings?.support_phone?.trim();
    return (
      <div className="sticky top-0 z-40">
        {announcement && (
          <div className="bg-[var(--st-accent)] px-4 py-1.5 text-center text-[12px] font-medium text-[var(--st-on-accent)]">
            {announcement}
          </div>
        )}
        <header className={cx("border-b bg-[var(--st-surface)]", borderc)}>
          <div className="mx-auto max-w-6xl px-3 py-2.5">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden"
                aria-label="Menu"
                onClick={() => setOpen((o) => !o)}
              >
                {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <div className="mx-auto md:mx-0">
                <Logo />
              </div>
              <SearchBox variant="sohoj" className="mx-auto hidden w-full max-w-md md:block" />
              {phone && (
                <a href={`tel:${phone}`} className="ml-auto hidden text-right leading-tight sm:block">
                  <span className={cx("block text-[11px]", muted)}>
                    {content.text("sohoj_call_label") || "অর্ডার করতে কল করুন"}
                  </span>
                  <span className="flex items-center justify-end gap-1 text-sm font-extrabold text-[var(--st-primary)]">
                    <Phone className="h-3.5 w-3.5" /> {phone}
                  </span>
                </a>
              )}
              <div className={cx("shrink-0", phone ? "ml-2" : "ml-auto")}>
                <CartButton />
              </div>
            </div>
            <div className="mt-2.5 md:hidden">
              <SearchBox variant="sohoj" />
            </div>
          </div>

          <div className="hidden bg-[var(--st-primary)] md:block">
            <div className="mx-auto max-w-6xl px-3 text-[var(--st-on-primary)] [&_a:hover]:!opacity-80 [&_a]:!border-transparent [&_a]:!font-bold [&_a]:!text-[var(--st-on-primary)]">
              <CategoryNav variant="row" />
            </div>
          </div>

          <MobileDrawer open={open} onClose={() => setOpen(false)} />
        </header>
      </div>
    );
  }






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
          <MobileDrawer open={open} onClose={() => setOpen(false)} />
        </header>
      ) : v === "editorial" ? (
        <header className={cx("border-b bg-[var(--st-bg)]", borderc)}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5">
            <div className="shrink-0">
              <Logo />
            </div>
            <div className="hidden min-w-0 flex-1 justify-center md:flex">
              <CategoryNav variant="row" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SearchBox className="hidden w-56 lg:block" />
              <CartButton />
              <button className="md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <MobileDrawer open={open} onClose={() => setOpen(false)} />
        </header>
      ) : (
        <header className={cx("border-b bg-[var(--st-bg)]/80 backdrop-blur-xl", borderc)}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
            <div className="shrink-0">
              <Logo />
            </div>
            <SearchBox className="mx-1 min-w-0 flex-1 max-w-md sm:mx-2" />
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <CartButton />
              <button
                className="rounded-md p-1.5 hover:bg-[var(--st-bg-alt)] md:hidden"
                aria-label="Menu"
                onClick={() => setOpen((o) => !o)}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className={cx("mx-auto hidden max-w-6xl px-4 pb-3 md:block")}>
            <CategoryNav variant="row" />
          </div>
          <MobileDrawer open={open} onClose={() => setOpen(false)} />
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

  if (theme.id === "bazaar")
    return (
      <section className="bg-[var(--st-primary)] text-[var(--st-on-primary)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-2 text-[12px] font-semibold uppercase">
          {items.map((i) => (
            <span key={i.t}>{i.t}</span>
          ))}
        </div>
      </section>
    );

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
  const { name, settings, theme, url, content } = useStore();
  const year = new Date().getFullYear();
  const socials = [
    settings?.facebook_url && { label: "Facebook", href: settings.facebook_url },
    settings?.instagram_url && { label: "Instagram", href: settings.instagram_url },
    settings?.tiktok_url && { label: "TikTok", href: settings.tiktok_url },
  ].filter(Boolean) as { label: string; href: string }[];

  const about =
    content?.text("footer_about") ||
    settings?.about_text ||
    settings?.meta_description ||
    `${name} — genuine products, honest pricing and fast cash on delivery across Bangladesh.`;
  const wa = settings?.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/[^\d]/g, "")}` : undefined;
  const copy =
    content?.text("footer_note") ||
    settings?.footer_text ||
    `© ${year} ${name}. All rights reserved.`;

  /* ------------------------------------------- Bazaar: dense utility footer */
  if (theme.id === "bazaar")
    return (
      <footer className="mt-10">
        {(settings?.support_phone || wa) && (
          <div className="bg-[var(--st-accent)] px-4 py-5 text-center text-[var(--st-on-accent)]">
            <div className="text-base font-extrabold uppercase tracking-wide">Order now — cash on delivery</div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
              {settings?.support_phone && (
                <a
                  href={`tel:${settings.support_phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--st-primary)] px-5 py-2 text-sm font-bold text-[var(--st-on-primary)] shadow-sm transition hover:opacity-90"
                >
                  <Phone className="h-4 w-4" /> Call {settings.support_phone}
                </a>
              )}
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-current bg-transparent px-5 py-2 text-sm font-bold transition hover:bg-black/10"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
        <div className={cx("border-t bg-[var(--st-surface)]", borderc)}>
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <div className="text-base font-extrabold uppercase text-[var(--st-fg)]">{name}</div>
              <p className={cx("mt-2 text-xs leading-relaxed whitespace-pre-line", muted)}>{about}</p>
              {socials.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-alt)] px-3 py-1 text-xs font-semibold hover:text-[var(--st-primary)]"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--st-fg)]">Quick Links</div>
              <div className="flex flex-col gap-2">
                <Link to={url("/")} className={cx("text-xs hover:text-[var(--st-primary)]", muted)}>
                  Home
                </Link>
                <Link to={url("/shop")} className={cx("text-xs hover:text-[var(--st-primary)]", muted)}>
                  All products
                </Link>
                <Link to={url("/checkout")} className={cx("text-xs hover:text-[var(--st-primary)]", muted)}>
                  Cart / Checkout
                </Link>
              </div>
            </div>
            <div>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--st-fg)]">Customer Support</div>
              <div className={cx("flex flex-col gap-2 text-xs", muted)}>
                {settings?.support_phone && (
                  <a href={`tel:${settings.support_phone}`} className="inline-flex items-center gap-1.5 hover:text-[var(--st-primary)]">
                    <Phone className="h-3.5 w-3.5" /> {settings.support_phone}
                  </a>
                )}
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[var(--st-primary)]">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp chat
                  </a>
                )}
                <div className="mt-1 text-[11px] text-[var(--st-muted)]">
                  Cash on Delivery available all over Bangladesh
                </div>
              </div>
            </div>
          </div>
          <div className={cx("border-t px-4 py-4 text-center text-xs", borderc, muted)}>{copy}</div>
        </div>
      </footer>
    );

  /* --------------------------------------------- Noir: centered luxe footer */
  if (theme.id === "noir")
    return (
      <footer className={cx("mt-20 border-t bg-[var(--st-bg-alt)]", borderc)}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Heading className="text-2xl tracking-[0.16em]">{name}</Heading>
          <p className={cx("mx-auto mt-4 max-w-lg text-sm leading-relaxed whitespace-pre-line", muted)}>{about}</p>
          <div className={cx("mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[11px] uppercase tracking-[0.2em]", muted)}>
            <Link to={url("/")} className="hover:text-[var(--st-primary)]">
              Home
            </Link>
            <Link to={url("/shop")} className="hover:text-[var(--st-primary)]">
              All products
            </Link>
            <Link to={url("/checkout")} className="hover:text-[var(--st-primary)]">
              Checkout
            </Link>
            {settings?.support_phone && (
              <a href={`tel:${settings.support_phone}`} className="hover:text-[var(--st-primary)]">
                {settings.support_phone}
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="hover:text-[var(--st-primary)]">
                WhatsApp
              </a>
            )}
            {socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="hover:text-[var(--st-primary)]">
                {s.label}
              </a>
            ))}
          </div>
          <div className={cx("mx-auto mt-8 h-px w-16 bg-[var(--st-primary)] opacity-40")} />
          <div className={cx("mt-5 text-[11px]", muted)}>{copy}</div>
        </div>
      </footer>
    );

  /* ------------------------- সহজ শপ: সরু কমলা ফুটার বার + ক্লিন লিংক */
  if (theme.id === "atelier")
    return (
      <footer className="mt-12">
        <div className={cx("border-t bg-[var(--st-surface)]", borderc)}>
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6">
            <div>
              <div className="text-sm font-bold text-[var(--st-fg)]">{name}</div>
              <p className={cx("mt-0.5 text-xs max-w-md whitespace-pre-line", muted)}>{about}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to={url("/")} className={cx("text-xs font-medium hover:text-[var(--st-primary)]", muted)}>
                হোম
              </Link>
              <span className="text-[var(--st-border)]">•</span>
              <Link to={url("/shop")} className={cx("text-xs font-medium hover:text-[var(--st-primary)]", muted)}>
                সব প্রোডাক্ট
              </Link>
              <span className="text-[var(--st-border)]">•</span>
              <Link to={url("/checkout")} className={cx("text-xs font-medium hover:text-[var(--st-primary)]", muted)}>
                অর্ডার চেকআউট
              </Link>
              {settings?.support_phone && (
                <>
                  <span className="text-[var(--st-border)]">•</span>
                  <a href={`tel:${settings.support_phone}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--st-bg-alt)] px-3 py-1 text-xs font-bold text-[var(--st-primary)]">
                    <Phone className="h-3 w-3" /> {settings.support_phone}
                  </a>
                </>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[var(--st-bg-alt)] px-3 py-1 text-xs font-bold text-emerald-600">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="bg-[var(--st-primary)] px-4 py-3 text-center text-xs font-semibold text-[var(--st-on-primary)]">
          {copy}
        </div>
      </footer>
    );

  /* ------------------------------------------- Aurora: soft gradient footer */
  return (
    <footer className={cx("relative mt-16 overflow-hidden border-t bg-[var(--st-bg-alt)]", borderc)}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{ background: "radial-gradient(700px 260px at 15% 0%, var(--st-primary), transparent 62%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Heading className="text-lg">{name}</Heading>
            <p className={cx("mt-2 max-w-md text-xs leading-relaxed whitespace-pre-line", muted)}>{about}</p>
            {socials.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[var(--st-surface)] px-3.5 py-1 text-xs shadow-sm hover:text-[var(--st-primary)]"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--st-fg)]">Navigation</div>
            <div className="flex flex-col gap-2">
              <Link to={url("/")} className={cx("text-xs hover:text-[var(--st-primary)]", muted)}>
                Home
              </Link>
              <Link to={url("/shop")} className={cx("text-xs hover:text-[var(--st-primary)]", muted)}>
                All products
              </Link>
              <Link to={url("/checkout")} className={cx("text-xs hover:text-[var(--st-primary)]", muted)}>
                Cart / Checkout
              </Link>
            </div>
          </div>
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--st-fg)]">Support & Contact</div>
            <div className={cx("flex flex-col gap-2.5 text-xs", muted)}>
              {settings?.support_phone && (
                <a href={`tel:${settings.support_phone}`} className="inline-flex items-center gap-1.5 hover:text-[var(--st-primary)]">
                  <Phone className="h-3.5 w-3.5" /> Call {settings.support_phone}
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[var(--st-primary)]">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp chat
                </a>
              )}
              <p className="text-[11px] opacity-75">Cash on delivery available across Bangladesh</p>
            </div>
          </div>
        </div>
      </div>
      <div className={cx("relative border-t px-4 py-4 text-center text-xs", borderc, muted)}>{copy}</div>
    </footer>
  );
}
