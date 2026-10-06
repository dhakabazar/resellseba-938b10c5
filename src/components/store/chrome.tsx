import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, Menu, MessageCircle, Phone, Search, ShoppingBag, X } from "lucide-react";
import { menuTarget, type MenuNode } from "@/lib/store-menu";
import { bdt } from "@/lib/store-cart";

import { useStore, type StoreListing } from "./store-context";
import { borderc, cx, Heading, muted } from "./ui";
import { trackSearch, trackViewCategory } from "@/lib/tracking";

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

function SearchBox({
  className,
  variant = "default",
  autoFocus,
  onSubmitted,
}: {
  className?: string;
  variant?: "default" | "sohoj";
  autoFocus?: boolean;
  onSubmitted?: () => void;
}) {
  const store = useStore();
  const { code, url, listings } = store;
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [openSuggest, setOpenSuggest] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clean = q.trim();

  const suggestions = useMemo(() => {
    if (!clean) return [];
    const term = clean.toLowerCase();
    return listings
      .filter(
        (l) =>
          store.title(l).toLowerCase().includes(term) ||
          String(l.product?.product_code ?? "").toLowerCase().includes(term) ||
          String(l.product?.short_description ?? "").toLowerCase().includes(term)
      )
      .slice(0, 5);
  }, [clean, listings, store]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenSuggest(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setOpenSuggest(false);
    if (clean) {
      trackSearch({ query: clean, resultCount: suggestions.length });
    }
    nav({ to: url("/"), search: { q: clean || undefined } as any });
    onSubmitted?.();
  };

  const handleSelect = (slug?: string) => {
    setOpenSuggest(false);
    onSubmitted?.();
    if (slug) {
      nav({ to: url(`/p/${slug}`) });
    }
  };

  return (
    <div ref={containerRef} className={cx("relative", className)}>
      {variant === "sohoj" ? (
        <form onSubmit={submit} className="relative flex items-center">
          <input
            autoFocus={autoFocus}
            value={q}
            onFocus={() => setOpenSuggest(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpenSuggest(true);
            }}
            placeholder="পণ্য খুঁজুন…"
            aria-label="Search products"
            className={cx(
              "w-full rounded-[var(--st-radius)] border bg-[var(--st-surface)] py-2 pl-3.5 pr-24 text-xs text-[var(--st-fg)] outline-none placeholder:text-[var(--st-muted)] focus:border-[var(--st-primary)] sm:py-2.5 sm:pl-4 sm:pr-24 sm:text-sm",
              borderc,
            )}
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ("");
                setOpenSuggest(false);
              }}
              className="absolute right-16 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[var(--st-muted)] hover:text-[var(--st-fg)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Search"
            className="absolute right-1 top-1 bottom-1 flex items-center gap-1.5 rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] px-3 text-xs font-bold text-[var(--st-on-primary)] shadow-sm transition-all hover:opacity-90 active:scale-95"
          >
            <Search className="h-3.5 w-3.5" />
            <span>খুঁজুন</span>
          </button>
        </form>
      ) : (
        <form onSubmit={submit} className="relative flex items-center">
          <Search className={cx("pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 sm:left-3 sm:h-4 sm:w-4", muted)} />
          <input
            autoFocus={autoFocus}
            value={q}
            onFocus={() => setOpenSuggest(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpenSuggest(true);
            }}
            placeholder="প্রোডাক্ট খুঁজুন…"
            aria-label="Search products"
            className={cx(
              "w-full rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] py-1.5 pl-8 pr-16 text-xs text-[var(--st-fg)] outline-none placeholder:text-[var(--st-muted)] focus:border-[var(--st-primary)] sm:py-2 sm:pl-9 sm:pr-20 sm:text-sm",
              borderc,
            )}
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ("");
                setOpenSuggest(false);
              }}
              className="absolute right-12 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[var(--st-muted)] hover:text-[var(--st-fg)] sm:right-16"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Search"
            className="absolute right-0.5 top-0.5 bottom-0.5 flex items-center gap-1 rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] px-2 text-[11px] font-bold text-[var(--st-on-primary)] shadow-sm transition-all hover:opacity-90 active:scale-95 sm:right-1 sm:top-1 sm:bottom-1 sm:px-3 sm:text-xs"
          >
            <Search className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden xs:inline sm:inline">খুঁজুন</span>
          </button>
        </form>
      )}

      {/* Suggestion Dropdown */}
      {openSuggest && clean && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[360px] overflow-y-auto rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--st-muted)] border-b border-[var(--st-border)]">
            সাজেশন ({suggestions.length})
          </div>
          {suggestions.length > 0 ? (
            <div className="py-1">
              {suggestions.map((item) => {
                const img = store.image(item);
                const title = store.title(item);
                const price = Number(item.selling_price);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.product?.slug)}
                    className="flex w-full items-center gap-3 rounded-[var(--st-radius-sm)] p-2 text-left transition-colors hover:bg-[var(--st-bg-alt)]"
                  >
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-[var(--st-bg-alt)] border border-[var(--st-border)]">
                      {img ? (
                        <img src={img} alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-[var(--st-muted)]">No img</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[var(--st-fg)] sm:text-sm">{title}</div>
                      <div className="mt-0.5 text-xs font-bold text-[var(--st-primary)]">{bdt(price)}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--st-muted)] opacity-60" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => submit()}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-alt)] py-2 text-center text-xs font-bold text-[var(--st-primary)] hover:bg-[var(--st-primary)] hover:text-[var(--st-on-primary)] transition-colors"
              >
                <span>“{clean}” এর সকল প্রোডাক্ট দেখুন</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[var(--st-muted)]">
              “{clean}” দিয়ে কোনো প্রোডাক্ট পাওয়া যায়নি
            </div>
          )}
        </div>
      )}
    </div>
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
  const [searchOpen, setSearchOpen] = useState(false);
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
                <a
                  href={`tel:${phone}`}
                  className="ml-auto hidden items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-primary)]/25 bg-[var(--st-primary)]/10 px-3.5 py-2 text-xs font-bold text-[var(--st-primary)] shadow-sm transition-all hover:bg-[var(--st-primary)] hover:text-[var(--st-on-primary)] sm:flex"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>{phone}</span>
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
        <div className="bg-[var(--st-accent)] px-4 py-1.5 text-center text-[12px] font-semibold text-[var(--st-on-accent)] shadow-sm">
          {announcement}
        </div>
      )}

      {v === "bar" ? (
        <div className="bg-[var(--st-surface)]">
          <div className="bg-[var(--st-primary)] text-[var(--st-on-primary)]">
            <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4">
              <div className="rounded-[var(--st-radius-sm)] bg-[var(--st-surface)] px-2 py-1 text-[var(--st-fg)]">
                <Logo />
              </div>
              <SearchBox className="hidden flex-1 md:block" />
              <div className="ml-auto flex items-center gap-3 sm:gap-3.5 text-[var(--st-on-primary)]">
                {settings?.support_phone && (
                  <a
                    href={`tel:${settings.support_phone}`}
                    className="hidden items-center gap-1.5 rounded-[var(--st-radius-sm)] bg-[var(--st-surface)] px-3 py-1.5 text-xs font-bold text-[var(--st-fg)] shadow-sm transition-all hover:opacity-90 sm:flex"
                  >
                    <Phone className="h-3.5 w-3.5 text-[var(--st-primary)]" />
                    <span>{settings.support_phone}</span>
                  </a>
                )}
                <button
                  type="button"
                  aria-label="Search"
                  onClick={() => setSearchOpen((s) => !s)}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-surface)] text-[var(--st-fg)] md:hidden transition-opacity hover:opacity-90"
                >
                  {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                </button>
                <div className="rounded-[var(--st-radius-sm)] bg-[var(--st-surface)] text-[var(--st-fg)]">
                  <CartButton />
                </div>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-surface)] text-[var(--st-fg)] md:hidden transition-opacity hover:opacity-90"
                  aria-label="Menu"
                  onClick={() => setOpen((o) => !o)}
                >
                  {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          {searchOpen && (
            <div className={cx("border-b bg-[var(--st-surface)] px-4 py-2.5 md:hidden", borderc)}>
              <SearchBox autoFocus onSubmitted={() => setSearchOpen(false)} className="w-full" />
            </div>
          )}
          <div className={cx("hidden border-b md:block", borderc)}>
            <div className="mx-auto max-w-6xl px-4">
              <CategoryNav variant="row" />
            </div>
          </div>
          <MobileDrawer open={open} onClose={() => setOpen(false)} />
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
              <div className="flex items-center gap-3 sm:gap-3.5">
                <SearchBox className="hidden w-64 lg:block" />
                {settings?.support_phone && (
                  <a
                    href={`tel:${settings.support_phone}`}
                    className="hidden items-center gap-1.5 rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-3 py-1.5 text-xs font-bold text-[var(--st-fg)] shadow-sm transition-all hover:border-[var(--st-primary)] hover:text-[var(--st-primary)] sm:flex"
                  >
                    <Phone className="h-3.5 w-3.5 text-[var(--st-primary)]" />
                    <span>{settings.support_phone}</span>
                  </a>
                )}
                <button
                  type="button"
                  aria-label="Search"
                  onClick={() => setSearchOpen((s) => !s)}
                  className={cx(
                    "flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] border text-[var(--st-fg)] transition-colors hover:border-[var(--st-primary)] lg:hidden",
                    borderc,
                  )}
                >
                  {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                </button>
                <CartButton />
              </div>
            </div>
            {searchOpen && (
              <div className={cx("w-full border-t pt-3 lg:hidden", borderc)}>
                <SearchBox autoFocus onSubmitted={() => setSearchOpen(false)} className="w-full" />
              </div>
            )}
            <div className="hidden md:block">
              <CategoryNav variant="row" />
            </div>
          </div>
          <MobileDrawer open={open} onClose={() => setOpen(false)} />
        </header>
      ) : v === "editorial" ? (
        <header className={cx("border-b bg-[var(--st-bg)]", borderc)}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:gap-6 sm:px-5 sm:py-5">
            <div className="shrink-0">
              <Logo />
            </div>
            <div className="hidden min-w-0 flex-1 justify-center md:flex">
              <CategoryNav variant="row" />
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:gap-3.5">
              <SearchBox className="hidden w-56 lg:block" />
              {settings?.support_phone && (
                <a
                  href={`tel:${settings.support_phone}`}
                  className="hidden items-center gap-1.5 rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-3 py-1.5 text-xs font-bold text-[var(--st-fg)] shadow-sm transition-all hover:border-[var(--st-primary)] hover:text-[var(--st-primary)] md:flex"
                >
                  <Phone className="h-3.5 w-3.5 text-[var(--st-primary)]" />
                  <span>{settings.support_phone}</span>
                </a>
              )}
              <button
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen((s) => !s)}
                className={cx(
                  "flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] border text-[var(--st-fg)] transition-colors hover:border-[var(--st-primary)] lg:hidden",
                  borderc,
                )}
              >
                {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
              <CartButton />
              <button className="md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {searchOpen && (
            <div className={cx("border-t bg-[var(--st-surface)] px-4 py-2.5 lg:hidden", borderc)}>
              <SearchBox autoFocus onSubmitted={() => setSearchOpen(false)} className="w-full" />
            </div>
          )}
          <MobileDrawer open={open} onClose={() => setOpen(false)} />
        </header>
      ) : (
        <header className={cx("border-b bg-[var(--st-bg)]/80 backdrop-blur-xl", borderc)}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
            <div className="shrink-0">
              <Logo />
            </div>
            <SearchBox className="mx-1 min-w-0 flex-1 max-w-md sm:mx-2" />
            <div className="flex shrink-0 items-center gap-3 sm:gap-3.5">
              {settings?.support_phone && (
                <a
                  href={`tel:${settings.support_phone}`}
                  className="hidden items-center gap-1.5 rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-3 py-1.5 text-xs font-bold text-[var(--st-fg)] shadow-sm transition-all hover:border-[var(--st-primary)] hover:text-[var(--st-primary)] sm:flex"
                >
                  <Phone className="h-3.5 w-3.5 text-[var(--st-primary)]" />
                  <span>{settings.support_phone}</span>
                </a>
              )}
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

function SocialIcon({ type }: { type: string }) {
  switch (type.toLowerCase()) {
    case "facebook":
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.89 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.3 0 .58.04.85.12V9.43a6.37 6.37 0 0 0-.85-.06A6.34 6.34 0 0 0 3 15.68a6.34 6.34 0 0 0 6.34 6.34c3.5 0 6.34-2.84 6.34-6.34V8.45a8.28 8.28 0 0 0 3.91 1.05v-3.45c-.24 0-.48-.04-.72-.08z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      );
    default:
      return null;
  }
}

function getSocialBgClass(label: string) {
  switch (label.toLowerCase()) {
    case "facebook":
      return "bg-[#1877F2] text-white hover:brightness-110 shadow-sm";
    case "instagram":
      return "bg-gradient-to-tr from-[#fdf497] via-[#fd5949] via-[#d6249f] to-[#285AEB] text-white hover:brightness-110 shadow-sm";
    case "tiktok":
      return "bg-[#010101] text-white hover:bg-black/90 shadow-sm border border-white/10";
    case "whatsapp":
      return "bg-[#25D366] text-white hover:brightness-110 shadow-sm";
    default:
      return "bg-[var(--st-primary)] text-[var(--st-on-primary)]";
  }
}

export function StoreFooter() {
  const { name, url } = useStore();
  const year = new Date().getFullYear();

  return (
    <footer className={cx("mt-16 border-t bg-[var(--st-bg-alt)]/60 text-xs text-[var(--st-muted)]", borderc)}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:text-left">
        <div>
          © {year} <span className="font-semibold text-[var(--st-fg)]">{name}</span>. All rights reserved.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <Link
            to={url("/privacy")}
            className="font-medium text-[var(--st-fg)]/85 transition-colors hover:text-[var(--st-primary)] hover:underline"
          >
            Privacy Policy
          </Link>
          <span className="text-[var(--st-border)]">•</span>
          <a
            href="https://ecomsellerbd.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--st-fg)]/85 transition-colors hover:text-[var(--st-primary)]"
          >
            Made with <span className="font-semibold text-[var(--st-primary)] hover:underline">ecomsellerbd.com</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
