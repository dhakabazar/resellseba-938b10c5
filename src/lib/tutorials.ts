import { supabase } from "@/integrations/supabase/client";

export type TutorialTopic = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Tutorial = {
  id: string;
  topic_id: string | null;
  title: string;
  details: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
  duration_label: string | null;
  sort_order: number;
  is_active: boolean;
  reseller_only: boolean;
};

/** Extract the YouTube video id from watch / youtu.be / shorts / embed links. */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const v = url.trim();
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /\/shorts\/([A-Za-z0-9_-]{6,})/,
    /\/embed\/([A-Za-z0-9_-]{6,})/,
    /\/live\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const m = v.match(p);
    if (m?.[1]) return m[1];
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  return null;
}

export function youtubeThumb(url: string, fallback?: string | null) {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : (fallback ?? null);
}

export function youtubeEmbed(url: string) {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

export function slugify(v: string) {
  const base = v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `topic-${Date.now().toString(36)}`;
}

export function tutorialSlug(t: Tutorial) {
  return slugify(t.title);
}

/** Topics + tutorials visible to the current viewer (RLS handles reseller-only). */
export async function loadTutorialLibrary() {
  const [t, v] = await Promise.all([
    supabase
      .from("tutorial_topics")
      .select("id,name,slug,description,sort_order,is_active")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("tutorials")
      .select("id,topic_id,title,details,youtube_url,thumbnail_url,duration_label,sort_order,is_active,reseller_only")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at", { ascending: false }),
  ]);
  return {
    topics: (t.data ?? []) as TutorialTopic[],
    tutorials: (v.data ?? []) as Tutorial[],
  };
}
