import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, Menu, Minus, Plus, Search, ShoppingBag, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inCategory, categoryIdsOf } from "@/lib/product-categories";
import { addToCart, bdt } from "@/lib/store-cart";
import { trackAddToCart, trackViewContent } from "@/lib/tracking";
import { useStore, type StoreListing } from "../store-context";

const cn = (...v: (string | false | null | undefined)[]) => v.filter(Boolean).join(" ");

function Brand() {
  const { code, name, settings } = useStore();
  return (
    <Link to="/s/$code" params={{ code }} className="flex min-w-0 items-center gap-3">
      {settings?.logo_url ? <img src={settings.logo_url} alt={name} className="h-9 w-auto max-w-[170px] object-contain" /> : (
        <><span className="grid h-9 w-9 place-items-center bg-[var(--st-fg)] text-sm font-bold text-[var(--st-surface)]">{name[0]?.toUpperCase()}</span><strong className="truncate text-lg">{name}</strong></>
      )}
    </Link>
  );
}

function SearchForm({ close }: { close?: () => void }) {
  const { code } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return <form className="relative" onSubmit={(e) => { e.preventDefault(); close?.(); navigate({ to: "/s/$code", params: { code }, search: { q: q || undefined } }); }}>
    <input aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the collection" className="h-10 w-full border-b border-[var(--st-border)] bg-transparent pl-0 pr-9 text-sm outline-none focus:border-[var(--st-primary)]" />
    <button aria-label="Search" className="absolute right-0 top-0 grid h-10 w-8 place-items-center"><Search className="h-4 w-4" /></button>
  </form>;
}

export function PoripatiChrome({ children }: { children: ReactNode }) {
  const { code, name, settings, categories, cartCount } = useStore();
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();
  const phone = settings?.support_phone?.trim();
  return <>
    {settings?.announcement && <div className="bg-[var(--st-fg)] px-4 py-2 text-center text-[11px] font-semibold text-[var(--st-surface)]">{settings.announcement}</div>}
    <header className="sticky top-0 z-40 border-b border-[var(--st-border)] bg-[var(--st-surface)]/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4">
        <div className="hidden h-8 items-center justify-between border-b border-[var(--st-border)] text-[11px] text-[var(--st-muted)] md:flex"><span>Curated products. Clear choices.</span>{phone && <a href={`tel:${phone}`}>Call {phone}</a>}</div>
        <div className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-5 md:h-20 md:grid-cols-[1fr_auto_1fr]">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="md:hidden"><Menu className="h-5 w-5" /></button>
          <div className="hidden max-w-xs md:block"><SearchForm /></div><div className="justify-self-center"><Brand /></div>
          <div className="flex items-center justify-end gap-4"><Link to="/s/$code/shop" params={{ code }} className="hidden text-sm font-medium md:block">Shop all</Link><Link to="/s/$code/checkout" params={{ code }} aria-label="Cart" className="relative"><ShoppingBag className="h-5 w-5" />{cartCount > 0 && <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center bg-[var(--st-primary)] px-1 text-[9px] font-bold text-[var(--st-on-primary)]">{cartCount}</span>}</Link></div>
        </div>
        <nav className="hidden items-center justify-center gap-7 border-t border-[var(--st-border)] py-3 text-[12px] font-semibold md:flex"><Link to="/s/$code/shop" params={{ code }}>All products</Link>{categories.slice(0, 7).map(c => <Link key={c.id} to="/s/$code/c/$slug" params={{ code, slug: c.slug }} className="hover:text-[var(--st-primary)]">{c.name}</Link>)}</nav>
      </div>
    </header>
    {open && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-[var(--st-fg)]/45" onClick={() => setOpen(false)} /><aside className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-[var(--st-surface)] p-5"><div className="flex items-center justify-between"><Brand /><button aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div><div className="mt-8"><SearchForm close={() => setOpen(false)} /></div><nav className="mt-8 flex flex-col border-t border-[var(--st-border)]"> <Link to="/s/$code/shop" params={{ code }} onClick={() => setOpen(false)} className="border-b border-[var(--st-border)] py-4 font-semibold">All products</Link>{categories.map(c => <Link key={c.id} to="/s/$code/c/$slug" params={{ code, slug: c.slug }} onClick={() => setOpen(false)} className="border-b border-[var(--st-border)] py-4">{c.name}</Link>)}</nav>{phone && <a href={`tel:${phone}`} className="mt-auto bg-[var(--st-fg)] px-4 py-3 text-center text-sm font-bold text-[var(--st-surface)]">Call {phone}</a>}</aside></div>}
    <main>{children}</main>
    <footer className="mt-20 border-t border-[var(--st-border)] bg-[var(--st-fg)] text-[var(--st-surface)]"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr]"><div><div className="text-2xl font-bold">{name}</div><p className="mt-3 max-w-md text-sm opacity-70">{settings?.about_text || settings?.meta_description || "Useful products, thoughtfully selected and clearly presented."}</p></div><div><div className="mb-4 text-xs font-bold">EXPLORE</div><div className="flex flex-col gap-2 text-sm opacity-75"><Link to="/s/$code/shop" params={{ code }}>All products</Link>{categories.slice(0, 4).map(c => <Link key={c.id} to="/s/$code/c/$slug" params={{ code, slug: c.slug }}>{c.name}</Link>)}</div></div><div><div className="mb-4 text-xs font-bold">CONTACT</div><div className="flex flex-col gap-2 text-sm opacity-75">{phone && <a href={`tel:${phone}`}>{phone}</a>}{settings?.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}>WhatsApp</a>}{settings?.facebook_url && <a href={settings.facebook_url}>Facebook</a>}</div></div></div><div className="border-t border-current/20 px-4 py-5 text-center text-xs opacity-60">{settings?.footer_text || `© ${year} ${name}. All rights reserved.`}</div></footer>
  </>;
}

function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return <div className="mb-7 flex items-end justify-between gap-4"><div>{kicker && <div className="mb-2 text-[10px] font-bold uppercase text-[var(--st-primary)]">{kicker}</div>}<h2 className="text-2xl font-bold md:text-3xl">{title}</h2></div>{action}</div>;
}

function Card({ listing }: { listing: StoreListing }) {
  const store = useStore(); const p = listing.product; if (!p) return null;
  const image = store.image(listing);
  return <Link to="/s/$code/p/$slug" params={{ code: store.code, slug: p.slug }} className="group block"><div className="relative aspect-[4/5] overflow-hidden bg-[var(--st-bg-alt)]">{image ? <img src={image} alt={store.title(listing)} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center text-xs text-[var(--st-muted)]">No image</div>}<span className="absolute inset-x-3 bottom-3 translate-y-2 bg-[var(--st-surface)] px-3 py-2 text-center text-xs font-bold opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">View product</span></div><h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug">{store.title(listing)}</h3><div className="mt-1 text-sm font-bold text-[var(--st-primary)]">{bdt(Number(listing.selling_price))}</div></Link>;
}

export function PoripatiGrid({ listings }: { listings: StoreListing[] }) { return <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:gap-x-6 lg:grid-cols-4">{listings.map(l => <Card key={l.id} listing={l} />)}</div>; }

export function PoripatiHome({ query }: { query?: string }) {
  const store = useStore(); const { content, listings, categories, code, name } = store; const [visible, setVisible] = useState(20);
  const rows = useMemo(() => query ? listings.filter(l => `${store.title(l)} ${l.product?.product_code || ""}`.toLowerCase().includes(query.toLowerCase())) : listings, [listings, query, store]);
  if (query) return <PoripatiListing title={`Search: “${query}”`} listings={rows} />;
  const media = content.text("hero_image") || (listings[0] ? store.image(listings[0]) : undefined);
  const features = [1,2,3,4].map(i => ({ t: content.text(`usp${i}_t`), d: content.text(`usp${i}_d`) })).filter(i => i.t);
  return <div>
    {content.flag("hero_show") && <section className="relative min-h-[430px] overflow-hidden bg-[var(--st-fg)] md:min-h-[560px]">{media && <img src={media} alt={name} className="absolute inset-0 h-full w-full object-cover opacity-60 md:opacity-75" />}<div className="absolute inset-0 bg-[var(--st-fg)]/45 md:bg-transparent" /><div className="absolute inset-0 bg-gradient-to-r from-[var(--st-fg)]/90 via-[var(--st-fg)]/65 to-[var(--st-fg)]/20 md:from-[var(--st-fg)]/85 md:via-[var(--st-fg)]/25 md:to-transparent" /><div className="relative mx-auto flex min-h-[430px] max-w-7xl items-end px-4 pb-12 pt-20 text-[var(--st-surface)] md:min-h-[560px] md:items-center md:pb-20"><div className="max-w-xl"><div className="text-[11px] font-bold uppercase opacity-80">{content.text("poripati_kicker")}</div><h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">{content.text("hero_headline")}</h1><p className="mt-4 max-w-lg text-sm leading-relaxed opacity-85 md:text-base">{content.text("hero_sub")}</p><Link to="/s/$code/shop" params={{ code }} className="mt-7 inline-flex items-center gap-2 bg-[var(--st-primary)] px-6 py-3 text-sm font-bold text-[var(--st-on-primary)]">{content.text("hero_cta")} <ArrowRight className="h-4 w-4" /></Link></div></div></section>}
    {content.flag("usp_show") && <section className="border-b border-[var(--st-border)] bg-[var(--st-surface)]"><div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">{features.map((f,i) => <div key={f.t} className="border-r border-[var(--st-border)] px-4 py-5 last:border-r-0"><div className="text-[10px] font-bold text-[var(--st-primary)]">0{i+1}</div><div className="mt-1 text-sm font-semibold">{f.t}</div><div className="text-xs text-[var(--st-muted)]">{f.d}</div></div>)}</div></section>}
    {content.flag("cat_show") && categories.length > 0 && <section className="mx-auto max-w-7xl px-4 py-14"><SectionTitle kicker={content.text("cat_sub")} title={content.text("cat_title")} /><div className="flex snap-x gap-4 overflow-x-auto pb-2">{categories.map(c => <Link key={c.id} to="/s/$code/c/$slug" params={{ code, slug: c.slug }} className="group min-w-[145px] flex-1 snap-start md:min-w-[180px]"><div className="aspect-[4/3] overflow-hidden bg-[var(--st-bg-alt)]">{c.image_url ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <div className="grid h-full place-items-center text-2xl font-bold text-[var(--st-muted)]">{c.name[0]}</div>}</div><div className="mt-2 flex items-center justify-between text-sm font-semibold"><span>{c.name}</span><ArrowRight className="h-3.5 w-3.5" /></div></Link>)}</div></section>}
    <section className="border-y border-[var(--st-border)] bg-[var(--st-surface)]"><div className="mx-auto max-w-7xl px-4 py-14"><SectionTitle kicker={content.text("poripati_collection")} title={content.text("latest_title")} action={<Link to="/s/$code/shop" params={{ code }} className="text-xs font-bold text-[var(--st-primary)]">VIEW ALL</Link>} /><PoripatiGrid listings={listings.slice(0, visible)} />{visible < listings.length && <div className="mt-10 text-center"><Button variant="outline" onClick={() => setVisible(v => v + 20)}>Load more</Button></div>}</div></section>
    {content.text("poripati_story") && <section className="mx-auto max-w-5xl px-4 py-20 text-center"><div className="text-[10px] font-bold uppercase text-[var(--st-primary)]">Our point of view</div><p className="mt-5 text-2xl font-semibold leading-relaxed md:text-4xl">{content.text("poripati_story")}</p></section>}
    <PoripatiProof />
  </div>;
}

function PoripatiProof() { const { content } = useStore(); const [open,setOpen] = useState(0); const reviews=[1,2,3].map(i=>({text:content.text(`review${i}_text`),name:content.text(`review${i}_name`)})).filter(x=>x.text); const faqs=[1,2,3].map(i=>({q:content.text(`faq${i}_q`),a:content.text(`faq${i}_a`)})).filter(x=>x.q); return <>{content.flag("review_show") && reviews.length>0 && <section className="bg-[var(--st-bg-alt)]"><div className="mx-auto max-w-7xl px-4 py-16"><SectionTitle title={content.text("review_title")} /><div className="grid gap-px bg-[var(--st-border)] md:grid-cols-3">{reviews.map(r=><figure key={r.text} className="bg-[var(--st-surface)] p-6"><blockquote className="text-base leading-relaxed">“{r.text}”</blockquote><figcaption className="mt-5 text-xs font-bold text-[var(--st-primary)]">{r.name}</figcaption></figure>)}</div></div></section>}{content.flag("faq_show") && faqs.length>0 && <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[.7fr_1.3fr]"><SectionTitle title={content.text("faq_title")} /><div className="border-t border-[var(--st-border)]">{faqs.map((f,i)=><div key={f.q} className="border-b border-[var(--st-border)]"><button onClick={()=>setOpen(open===i?-1:i)} className="flex w-full items-center justify-between py-5 text-left text-sm font-semibold">{f.q}<ChevronDown className={cn("h-4 w-4 transition-transform",open===i&&"rotate-180")} /></button>{open===i&&<p className="pb-5 text-sm leading-relaxed text-[var(--st-muted)]">{f.a}</p>}</div>)}</div></section>}</>; }

export function PoripatiListing({ title, listings, categoryId }: { title: string; listings: StoreListing[]; categoryId?: string }) {
  const [sort,setSort]=useState("new"); const rows=useMemo(()=>{ const base=categoryId?listings.filter(l=>l.product&&inCategory(l.product,categoryId)):listings; const out=[...base]; if(sort==="low")out.sort((a,b)=>a.selling_price-b.selling_price); if(sort==="high")out.sort((a,b)=>b.selling_price-a.selling_price); return out;},[listings,categoryId,sort]);
  return <section className="mx-auto max-w-7xl px-4 py-12"><div className="mb-10 flex items-end justify-between gap-4 border-b border-[var(--st-border)] pb-6"><div><div className="text-[10px] font-bold uppercase text-[var(--st-primary)]">Browse collection</div><h1 className="mt-2 text-3xl font-bold md:text-5xl">{title}</h1><p className="mt-2 text-xs text-[var(--st-muted)]">{rows.length} products</p></div><select aria-label="Sort products" value={sort} onChange={e=>setSort(e.target.value)} className="border-b border-[var(--st-border)] bg-transparent px-2 py-2 text-xs outline-none"><option value="new">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>{rows.length?<PoripatiGrid listings={rows}/>:<div className="border border-dashed border-[var(--st-border)] py-24 text-center text-sm text-[var(--st-muted)]">No products found.</div>}</section>;
}

export function PoripatiProduct({ listing }: { listing: StoreListing }) {
  const store=useStore(); const navigate=useNavigate(); const [idx,setIdx]=useState(0); const [qty,setQty]=useState(1); const p=listing.product; const title=store.title(listing); const price=Number(listing.selling_price);
  useEffect(()=>{if(p) trackViewContent({id:p.id,name:title,price});},[p?.id,title,price]);
  if(!p)return null; const images=p.product_images||[]; const active=images[idx]?.url||store.image(listing); const related=store.listings.filter(l=>l.id!==listing.id&&l.product&&categoryIdsOf(p).some(id=>inCategory(l.product as NonNullable<typeof l.product>,id))).slice(0,4);
  const buy=(checkout:boolean)=>{addToCart(store.code,listing.id,qty);trackAddToCart({id:p.id,name:title,price,qty});if(checkout)navigate({to:"/s/$code/checkout",params:{code:store.code}});};
  return <div className="mx-auto max-w-7xl px-4 pb-16 pt-8"><nav className="mb-8 text-xs text-[var(--st-muted)]"><Link to="/s/$code/shop" params={{code:store.code}}>Shop</Link> / {title}</nav><div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr]"><div className="grid gap-3 sm:grid-cols-[80px_1fr]"><div className="order-2 flex gap-2 sm:order-1 sm:flex-col">{images.map((im,i)=><button key={im.url} onClick={()=>setIdx(i)} className={cn("aspect-square w-16 overflow-hidden border",i===idx?"border-[var(--st-primary)]":"border-[var(--st-border)]")}><img src={im.url} alt="" className="h-full w-full object-cover" /></button>)}</div><div className="order-1 aspect-[4/5] overflow-hidden bg-[var(--st-bg-alt)] sm:order-2">{active&&<img src={active} alt={title} className="h-full w-full object-cover" />}</div></div><aside className="lg:sticky lg:top-32 lg:h-fit"><div className="text-[10px] font-bold uppercase text-[var(--st-primary)]">{store.content.text("poripati_collection")}</div><h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{title}</h1><div className="mt-5 text-2xl font-bold text-[var(--st-primary)]">{bdt(price)}</div>{(listing.custom_description||p.short_description)&&<p className="mt-5 text-sm leading-relaxed text-[var(--st-muted)]">{listing.custom_description||p.short_description}</p>}<div className="mt-7 flex items-center border-y border-[var(--st-border)] py-4"><button aria-label="Decrease" onClick={()=>setQty(q=>Math.max(1,q-1))} className="p-2"><Minus className="h-4 w-4"/></button><span className="w-10 text-center text-sm font-bold">{qty}</span><button aria-label="Increase" onClick={()=>setQty(q=>q+1)} className="p-2"><Plus className="h-4 w-4"/></button></div><button onClick={()=>buy(true)} className="mt-5 flex w-full items-center justify-center gap-2 bg-[var(--st-primary)] px-5 py-4 text-sm font-bold text-[var(--st-on-primary)]">Order now <ArrowRight className="h-4 w-4"/></button><button onClick={()=>buy(false)} className="mt-2 flex w-full items-center justify-center gap-2 border border-[var(--st-border)] px-5 py-4 text-sm font-bold"><ShoppingBag className="h-4 w-4"/>Add to cart</button><div className="mt-6 space-y-3 border-t border-[var(--st-border)] pt-5 text-xs text-[var(--st-muted)]"><div className="flex gap-2"><Truck className="h-4 w-4 text-[var(--st-primary)]"/>Cash on delivery available</div><div className="flex gap-2"><Check className="h-4 w-4 text-[var(--st-primary)]"/>{store.content.text("pdp_returns")}</div></div></aside></div>{p.description&&<section className="mt-16 grid gap-6 border-t border-[var(--st-border)] pt-10 md:grid-cols-[.4fr_1fr]"><h2 className="text-xl font-bold">Product details</h2><div className="prose prose-sm max-w-none text-[var(--st-muted)]" dangerouslySetInnerHTML={{__html:p.description}}/></section>}{related.length>0&&<section className="mt-20"><SectionTitle title="You may also like"/><PoripatiGrid listings={related}/></section>}</div>;
}