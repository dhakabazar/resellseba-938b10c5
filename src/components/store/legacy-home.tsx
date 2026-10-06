import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "./store-context";
import { BenefitStrip, CategoryStrip, Hero, Reviews, ThemeSignature } from "./sections";
import { borderc, cx, EmptyState, GhostButton, Heading, muted, ProductGrid, SectionHead } from "./ui";
import { Button } from "@/components/ui/button";

export default function LegacyStoreHome({ query }: { query?: string }) {
  const store = useStore(); const { code, listings, name, content } = store; const [latestVisible,setLatestVisible]=useState(20);
  const results=useMemo(()=>{if(!query)return listings;const term=query.toLowerCase();return listings.filter(l=>store.title(l).toLowerCase().includes(term)||String(l.product?.product_code??"").toLowerCase().includes(term));},[query,listings,store]);
  const featured=listings.filter(l=>l.product?.is_featured).slice(0,8); const latest=listings.slice(0,latestVisible);
  if(query)return <div className="mx-auto max-w-6xl px-4 py-10"><SectionHead title={`Search: “${query}”`} subtitle={`${results.length} product${results.length===1?"":"s"} found`} action={<Link to={store.url("/")}><GhostButton>Clear</GhostButton></Link>} />{results.length?<ProductGrid listings={results}/>:<EmptyState title="Nothing matched" hint="Try a different keyword."/>}</div>;
  return <div><Hero/><ThemeSignature slot="top"/><BenefitStrip/><CategoryStrip/>{content.flag("featured_show")&&featured.length>0&&<section className={cx("border-y bg-[var(--st-bg-alt)]",borderc)}><div className="mx-auto max-w-6xl px-4 py-12"><SectionHead title={content.text("featured_title")}/><ProductGrid listings={featured}/></div></section>}<ThemeSignature/><section className="mx-auto max-w-6xl px-4 py-12"><SectionHead title={content.text("latest_title")}/>{latest.length?<><ProductGrid listings={latest}/>{latestVisible<listings.length&&<div className="mt-8 flex justify-center"><Button onClick={()=>setLatestVisible(v=>v+20)}>Load more</Button></div>}</>:<EmptyState title="No products listed yet" hint="Come back soon."/>}</section><Reviews/>{content.text("footer_about")&&<section className={cx("border-t",borderc)}><div className="mx-auto max-w-3xl px-4 py-14 text-center"><Heading className="text-2xl md:text-3xl">About {name}</Heading><p className={cx("mt-4 whitespace-pre-wrap text-sm leading-relaxed",muted)}>{content.text("footer_about")}</p></div></section>}</div>;
}