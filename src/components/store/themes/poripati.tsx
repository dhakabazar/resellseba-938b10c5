import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Menu, Minus, Plus, Search, ShoppingBag, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inCategory, categoryIdsOf } from "@/lib/product-categories";
import { addToCart, bdt } from "@/lib/store-cart";
import { trackAddToCart, trackViewContent } from "@/lib/tracking";
import { useStore, type StoreListing } from "../store-context";
import { ProductImageGallery } from "../ui";

const cn = (...v: (string | false | null | undefined)[]) => v.filter(Boolean).join(" ");

function Brand() {
  const { code, name, settings, url } = useStore();
  return (
    <Link to={url("/")} className="flex min-w-0 items-center gap-3">
      {settings?.logo_url ? <img src={settings.logo_url} alt={name} className="h-9 w-auto max-w-[170px] object-contain" /> : (
        <><span className="grid h-9 w-9 place-items-center bg-[var(--st-fg)] text-sm font-bold text-[var(--st-surface)]">{name[0]?.toUpperCase()}</span><strong className="truncate text-lg">{name}</strong></>
      )}
    </Link>
  );
}

function SearchForm({ close }: { close?: () => void }) {
  const { code, url } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return <form className="flex items-center overflow-hidden rounded-full border border-[var(--st-border)] bg-[var(--st-bg-alt)] transition-colors focus-within:border-[var(--st-primary)] focus-within:bg-[var(--st-surface)]" onSubmit={(e) => { e.preventDefault(); close?.(); navigate({ to: url("/"), search: { q: q || undefined } }); }}>
    <Search className="ml-3.5 h-4 w-4 shrink-0 text-[var(--st-muted)]" />
    <input aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন…" className="h-10 min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-[var(--st-muted)]" />
    {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="grid h-10 w-8 shrink-0 place-items-center text-[var(--st-muted)] hover:text-[var(--st-fg)]"><X className="h-4 w-4" /></button>}
    <button type="submit" aria-label="Search" className="mr-1 flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--st-primary)] px-3.5 text-xs font-bold text-[var(--st-on-primary)] sm:px-4">খুঁজুন</button>
  </form>;
}

export function PoripatiChrome({ children }: { children: ReactNode }) {
  const { code, name, settings, categories, cartCount, url } = useStore();
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();
  const phone = settings?.support_phone?.trim();
  return <>
    {settings?.announcement && <div className="bg-[var(--st-fg)] px-4 py-2 text-center text-[11px] font-semibold text-[var(--st-surface)]">{settings.announcement}</div>}
    <header className="sticky top-0 z-40 border-b border-[var(--st-border)] bg-[var(--st-surface)]/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-5 md:h-20 md:grid-cols-[1fr_auto_1fr]">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="md:hidden"><Menu className="h-5 w-5" /></button>
          <div className="hidden max-w-xs md:block"><SearchForm /></div><div className="justify-self-center"><Brand /></div>
          <div className="flex items-center justify-end gap-4"><Link to={url("/shop")} className="hidden text-sm font-medium md:block">Shop all</Link><Link to={url("/checkout")} aria-label="Cart" className="relative"><ShoppingBag className="h-5 w-5" />{cartCount > 0 && <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center bg-[var(--st-primary)] px-1 text-[9px] font-bold text-[var(--st-on-primary)]">{cartCount}</span>}</Link></div>
        </div>
        <nav className="hidden items-center justify-center gap-7 border-t border-[var(--st-border)] py-3 text-[12px] font-semibold md:flex"><Link to={url("/shop")}>All products</Link>{categories.slice(0, 7).map(c => <Link key={c.id} to={url(`/c/${c.slug}`)} className="hover:text-[var(--st-primary)]">{c.name}</Link>)}</nav>
      </div>
    </header>
    {open && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-[var(--st-fg)]/45" onClick={() => setOpen(false)} /><aside className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-[var(--st-surface)] p-5"><div className="flex items-center justify-between"><Brand /><button aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div><div className="mt-8"><SearchForm close={() => setOpen(false)} /></div><nav className="mt-8 flex flex-col border-t border-[var(--st-border)]"> <Link to={url("/shop")} onClick={() => setOpen(false)} className="border-b border-[var(--st-border)] py-4 font-semibold">All products</Link>{categories.map(c => <Link key={c.id} to={url(`/c/${c.slug}`)} onClick={() => setOpen(false)} className="border-b border-[var(--st-border)] py-4">{c.name}</Link>)}</nav>{phone && <a href={`tel:${phone}`} className="mt-auto bg-[var(--st-fg)] px-4 py-3 text-center text-sm font-bold text-[var(--st-surface)]">Call {phone}</a>}</aside></div>}
    <main>{children}</main>
    <footer className="mt-20 border-t border-[var(--st-border)] bg-[var(--st-fg)] text-[var(--st-surface)]"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr]"><div><div className="text-2xl font-bold">{name}</div><p className="mt-3 max-w-md text-sm opacity-70">{settings?.about_text || settings?.meta_description || `${name} — genuine products, fast cash on delivery across Bangladesh.`}</p></div><div><div className="mb-4 text-xs font-bold">EXPLORE</div><div className="flex flex-col gap-2.5 text-sm opacity-80"><Link to={url("/")} className="hover:opacity-100">Home</Link><Link to={url("/shop")} className="hover:opacity-100">All products</Link><Link to={url("/checkout")} className="hover:opacity-100">Cart / Checkout</Link></div></div><div><div className="mb-4 text-xs font-bold">CONTACT</div><div className="flex flex-col gap-2.5 text-sm opacity-80">{phone && <a href={`tel:${phone}`} className="hover:opacity-100">Call {phone}</a>}{settings?.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:opacity-100">WhatsApp</a>}{settings?.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noreferrer" className="hover:opacity-100">Facebook</a>}{settings?.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer" className="hover:opacity-100">Instagram</a>}</div></div></div><div className="border-t border-current/20 px-4 py-5 text-center text-xs opacity-60">{settings?.footer_text || `© ${year} ${name}. All rights reserved.`}</div></footer>
  </>;
}

function CategoryCarousel({ kicker, title }: { kicker?: string; title: string }) {
  const { categories, code, url } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || el.matches(":hover")) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      if (el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: Math.max(260, el.clientWidth * 0.5), behavior: "smooth" });
    }, 3200);
    return () => clearInterval(t);
  }, [categories.length]);
  const nudge = (dir: number) => { const el = ref.current; if (el) el.scrollBy({ left: dir * Math.max(260, el.clientWidth * 0.5), behavior: "smooth" }); };
  if (!categories.length) return null;
  return <section className="mx-auto max-w-7xl px-4 py-14">
    <SectionTitle kicker={kicker} title={title} />
    <div className="relative">
      <button aria-label="আগের ক্যাটাগরি" onClick={() => nudge(-1)} className="absolute -left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-fg)] shadow-sm transition-colors hover:border-[var(--st-primary)] hover:text-[var(--st-primary)] md:-left-5"><ChevronLeft className="h-5 w-5" /></button>
      <button aria-label="পরের ক্যাটাগরি" onClick={() => nudge(1)} className="absolute -right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-fg)] shadow-sm transition-colors hover:border-[var(--st-primary)] hover:text-[var(--st-primary)] md:-right-5"><ChevronRight className="h-5 w-5" /></button>
      <div ref={ref} className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth pb-2">
        {categories.map(c => <Link key={c.id} to={url(`/c/${c.slug}`)} className="group w-[45%] shrink-0 sm:w-[220px]"><div className="aspect-[4/3] overflow-hidden bg-[var(--st-bg-alt)]">{c.image_url ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <div className="grid h-full place-items-center text-2xl font-bold text-[var(--st-muted)]">{c.name[0]}</div>}</div><div className="mt-2 flex items-center justify-between text-sm font-semibold"><span>{c.name}</span><ArrowRight className="h-3.5 w-3.5" /></div></Link>)}
      </div>
    </div>
  </section>;
}

function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return <div className="mb-7 flex items-end justify-between gap-4"><div>{kicker && <div className="mb-2 text-[10px] font-bold uppercase text-[var(--st-primary)]">{kicker}</div>}<h2 className="text-2xl font-bold md:text-3xl">{title}</h2></div>{action}</div>;
}

function Card({ listing }: { listing: StoreListing }) {
  const store = useStore();
  const navigate = useNavigate();
  const p = listing.product;
  if (!p) return null;
  const image = store.image(listing);
  const price = Number(listing.selling_price);

  const handleDirectOrder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(store.code, listing.id, 1);
    trackAddToCart({ id: p.id, name: store.title(listing), price, qty: 1 });
    navigate({ to: store.url("/checkout") });
  };

  return (
    <Link to={store.url(`/p/${p.slug}`)} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--st-bg-alt)]">
        {image ? (
          <img
            src={image}
            alt={store.title(listing)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-[var(--st-muted)]">No image</div>
        )}
        <button
          type="button"
          onClick={handleDirectOrder}
          className="absolute inset-x-3 bottom-3 translate-y-2 bg-[var(--st-surface)] px-3 py-2 text-center text-xs font-bold opacity-0 transition-all hover:bg-[var(--st-primary)] hover:text-[var(--st-on-primary)] group-hover:translate-y-0 group-hover:opacity-100"
        >
          অর্ডার করুন
        </button>
      </div>
      <h3 className="mt-3 truncate text-sm font-medium leading-snug" title={store.title(listing)}>{store.title(listing)}</h3>
      <div className="mt-1 text-sm font-bold text-[var(--st-primary)]">{bdt(price)}</div>
    </Link>
  );
}

export function PoripatiGrid({ listings }: { listings: StoreListing[] }) { return <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:gap-x-6 lg:grid-cols-4">{listings.map(l => <Card key={l.id} listing={l} />)}</div>; }

export function PoripatiHome({ query }: { query?: string }) {
  const store = useStore(); const { content, listings, categories, code, name, url } = store; const [visible, setVisible] = useState(16);
  const rows = useMemo(() => query ? listings.filter(l => `${store.title(l)} ${l.product?.product_code || ""}`.toLowerCase().includes(query.toLowerCase())) : listings, [listings, query, store]);
  if (query) return <PoripatiListing title={`Search: “${query}”`} listings={rows} />;
  const media = content.text("hero_image") || (listings[0] ? store.image(listings[0]) : undefined);
  const features = [1,2,3,4].map(i => ({ t: content.text(`usp${i}_t`), d: content.text(`usp${i}_d`) })).filter(i => i.t);
  return <div>
    {content.flag("hero_show") && <section className="relative min-h-[430px] overflow-hidden bg-[var(--st-fg)] md:min-h-[560px]">{media && <img src={media} alt={name} className="absolute inset-0 h-full w-full object-cover opacity-60 md:opacity-75" />}<div className="absolute inset-0 bg-[var(--st-fg)]/45 md:bg-transparent" /><div className="absolute inset-0 bg-gradient-to-r from-[var(--st-fg)]/90 via-[var(--st-fg)]/65 to-[var(--st-fg)]/20 md:from-[var(--st-fg)]/85 md:via-[var(--st-fg)]/25 md:to-transparent" /><div className="relative mx-auto flex min-h-[430px] max-w-7xl items-end px-4 pb-12 pt-20 text-[var(--st-surface)] md:min-h-[560px] md:items-center md:pb-20"><div className="max-w-xl"><div className="text-[11px] font-bold uppercase opacity-80">{content.text("poripati_kicker")}</div><h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">{content.text("hero_headline")}</h1><p className="mt-4 max-w-lg text-sm leading-relaxed opacity-85 md:text-base">{content.text("hero_sub")}</p><Link to={url("/shop")} className="mt-7 inline-flex items-center gap-2 bg-[var(--st-primary)] px-6 py-3 text-sm font-bold text-[var(--st-on-primary)]">{content.text("hero_cta")} <ArrowRight className="h-4 w-4" /></Link></div></div></section>}
    {content.flag("usp_show") && <section className="border-b border-[var(--st-border)] bg-[var(--st-surface)]"><div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">{features.map((f,i) => <div key={f.t} className="border-r border-[var(--st-border)] px-4 py-5 last:border-r-0"><div className="text-[10px] font-bold text-[var(--st-primary)]">0{i+1}</div><div className="mt-1 text-sm font-semibold">{f.t}</div><div className="text-xs text-[var(--st-muted)]">{f.d}</div></div>)}</div></section>}
    {content.flag("cat_show") && <CategoryCarousel title={content.text("cat_title")} />}
    <section className="border-y border-[var(--st-border)] bg-[var(--st-surface)]"><div className="mx-auto max-w-7xl px-4 py-14"><SectionTitle kicker={content.text("poripati_collection")} title={content.text("latest_title")} action={<Link to={url("/shop")} className="text-xs font-bold text-[var(--st-primary)]">VIEW ALL</Link>} /><PoripatiGrid listings={listings.slice(0, visible)} />{visible < listings.length && <div className="mt-10 text-center"><Button variant="outline" className="rounded-full px-8 py-2.5 font-bold text-sm hover:bg-[var(--st-primary)] hover:text-[var(--st-on-primary)] transition-colors shadow-sm" onClick={() => setVisible(v => v + 16)}>আরও দেখুন</Button></div>}</div></section>
    {content.text("poripati_story") && <section className="mx-auto max-w-5xl px-4 py-20 text-center"><div className="text-[10px] font-bold uppercase text-[var(--st-primary)]">Our point of view</div><p className="mt-5 text-2xl font-semibold leading-relaxed md:text-4xl">{content.text("poripati_story")}</p></section>}
    <PoripatiProof />
  </div>;
}

function PoripatiProof() { const { content } = useStore(); const reviews=[1,2,3].map(i=>({text:content.text(`review${i}_text`),name:content.text(`review${i}_name`)})).filter(x=>x.text); return <>{content.flag("review_show") && reviews.length>0 && <section className="bg-[var(--st-bg-alt)]"><div className="mx-auto max-w-7xl px-4 py-16"><SectionTitle title={content.text("review_title")} /><div className="grid gap-px bg-[var(--st-border)] md:grid-cols-3">{reviews.map(r=><figure key={r.text} className="bg-[var(--st-surface)] p-6"><blockquote className="text-base leading-relaxed">“{r.text}”</blockquote><figcaption className="mt-5 text-xs font-bold text-[var(--st-primary)]">{r.name}</figcaption></figure>)}</div></div></section>}</>; }

export function PoripatiListing({ title, listings, categoryId }: { title: string; listings: StoreListing[]; categoryId?: string }) {
  const [sort,setSort]=useState("new"); const rows=useMemo(()=>{ const base=categoryId?listings.filter(l=>l.product&&inCategory(l.product,categoryId)):listings; const out=[...base]; if(sort==="low")out.sort((a,b)=>a.selling_price-b.selling_price); if(sort==="high")out.sort((a,b)=>b.selling_price-a.selling_price); return out;},[listings,categoryId,sort]);
  return <section className="mx-auto max-w-7xl px-4 py-12"><div className="mb-10 flex items-end justify-between gap-4 border-b border-[var(--st-border)] pb-6"><div><div className="text-[10px] font-bold uppercase text-[var(--st-primary)]">Browse collection</div><h1 className="mt-2 text-3xl font-bold md:text-5xl">{title}</h1><p className="mt-2 text-xs text-[var(--st-muted)]">{rows.length} products</p></div><select aria-label="Sort products" value={sort} onChange={e=>setSort(e.target.value)} className="border-b border-[var(--st-border)] bg-transparent px-2 py-2 text-xs outline-none"><option value="new">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>{rows.length?<PoripatiGrid listings={rows}/>:<div className="border border-dashed border-[var(--st-border)] py-24 text-center text-sm text-[var(--st-muted)]">No products found.</div>}</section>;
}

export function PoripatiProduct({ listing }: { listing: StoreListing }) {
  const store=useStore(); const navigate=useNavigate(); const [idx,setIdx]=useState(0); const [qty,setQty]=useState(1); const [relatedVisible,setRelatedVisible]=useState(16); const p=listing.product; const title=store.title(listing); const price=Number(listing.selling_price);
  useEffect(()=>{if(p) trackViewContent({id:p.id,name:title,price});},[p?.id,title,price]);
  if(!p)return null; const images=p.product_images||[]; const active=images[idx]?.url||store.image(listing);
  const sameCategory=store.listings.filter(l=>l.id!==listing.id&&l.product&&categoryIdsOf(p).some(id=>inCategory(l.product as NonNullable<typeof l.product>,id)));
  const otherProducts=store.listings.filter(l=>l.id!==listing.id&&!sameCategory.some(s=>s.id===l.id));
  const recommended=[...sameCategory,...otherProducts];
  const buy=(checkout:boolean)=>{addToCart(store.code,listing.id,qty);trackAddToCart({id:p.id,name:title,price,qty});if(checkout)navigate({to:store.url("/checkout")});else toast.success("কার্টে যোগ হয়েছে");};
  const galleryImages = images.length > 0 ? images : active ? [{ url: active }] : [];
  return <div className="mx-auto max-w-7xl px-4 pb-16 pt-8"><div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr]"><div className="min-w-0"><ProductImageGallery images={galleryImages} title={title} activeIdx={idx} onIndexChange={setIdx} /></div><aside className="min-w-0 lg:sticky lg:top-32 lg:h-fit"><div className="text-[10px] font-bold uppercase text-[var(--st-primary)]">{store.content.text("poripati_collection")}</div><h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{title}</h1><div className="mt-5 text-2xl font-bold text-[var(--st-primary)]">{bdt(price)}</div>{(listing.custom_description||p.short_description)&&<p className="mt-5 text-sm leading-relaxed text-[var(--st-muted)]">{listing.custom_description||p.short_description}</p>}<div className="mt-7 flex items-center border-y border-[var(--st-border)] py-4"><button aria-label="Decrease" onClick={()=>setQty(q=>Math.max(1,q-1))} className="p-2"><Minus className="h-4 w-4"/></button><span className="w-10 text-center text-sm font-bold">{qty}</span><button aria-label="Increase" onClick={()=>setQty(q=>q+1)} className="p-2"><Plus className="h-4 w-4"/></button></div><button onClick={()=>buy(true)} className="mt-5 flex w-full items-center justify-center gap-2 bg-[var(--st-primary)] px-5 py-4 text-sm font-bold text-[var(--st-on-primary)] animate-order-jiggle shadow-md">অর্ডার করুন <ArrowRight className="h-4 w-4"/></button><button onClick={()=>buy(false)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-primary)]/25 bg-[var(--st-primary)]/10 text-[var(--st-primary)] hover:bg-[var(--st-primary)]/15 px-5 py-4 text-sm font-bold transition-all"><ShoppingBag className="h-4 w-4"/>কার্টে যোগ করুন</button></aside></div>{p.description&&<section className="mt-16 grid gap-6 border-t border-[var(--st-border)] pt-10 md:grid-cols-[.4fr_1fr]"><h2 className="text-xl font-bold">Product details</h2><div className="prose prose-sm max-w-none text-[var(--st-muted)]" dangerouslySetInnerHTML={{__html:p.description}}/></section>}{recommended.length>0&&<section className="mt-20"><SectionTitle title="আপনার পছন্দ হতে পারে"/><PoripatiGrid listings={recommended.slice(0,relatedVisible)}/>{relatedVisible<recommended.length&&<div className="mt-10 text-center"><Button variant="outline" className="rounded-full px-8 py-2.5 font-bold text-sm hover:bg-[var(--st-primary)] hover:text-[var(--st-on-primary)] transition-colors shadow-sm" onClick={()=>setRelatedVisible(v=>v+16)}>আরও দেখুন</Button></div>}</section>}</div>;
}