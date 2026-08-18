import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_STORAGE_KEY = "sv_session";
/** Same path is not re-logged within this window (protects the API from bursts). */
const PATH_THROTTLE_MS = 30_000;
const lastLogged = new Map<string, number>();

function sessionKey() {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const fresh =
      (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "").slice(0, 32);
    sessionStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}

function deviceKind() {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/** Logs one storefront pageview per path (throttled), skipping panel previews. */
export function useStoreVisitLog(code: string | undefined, path: string, skip?: boolean) {
  useEffect(() => {
    if (!code || skip) return;
    const key = `${code}${path}`;
    const now = Date.now();
    const prev = lastLogged.get(key) ?? 0;
    if (now - prev < PATH_THROTTLE_MS) return;
    lastLogged.set(key, now);

    const sk = sessionKey();
    if (!sk) return;
    const timer = window.setTimeout(() => {
      supabase
        .rpc("log_store_visit", {
          _code: code,
          _path: path,
          _referrer: document.referrer || "",
          _session_key: sk,
          _device: deviceKind(),
        })
        .then(
          () => {},
          () => {},
        );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [code, path, skip]);
}

export type VisitRange = "today" | "yesterday" | "7d" | "30d";

export const VISIT_RANGES: { id: VisitRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

export function visitRangeBounds(range: VisitRange) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dayStart = start.getTime();
  const DAY = 86_400_000;
  switch (range) {
    case "today":
      return { from: new Date(dayStart).toISOString(), to: new Date(dayStart + DAY).toISOString() };
    case "yesterday":
      return { from: new Date(dayStart - DAY).toISOString(), to: new Date(dayStart).toISOString() };
    case "7d":
      return { from: new Date(dayStart - 6 * DAY).toISOString(), to: new Date(dayStart + DAY).toISOString() };
    default:
      return { from: new Date(dayStart - 29 * DAY).toISOString(), to: new Date(dayStart + DAY).toISOString() };
  }
}

/** Live refresh cadence — only while the tab is visible and only on visitor pages. */
export const LIVE_REFRESH_MS = 15_000;

export function useLiveRefresh(onTick: () => void, enabled = true, intervalMs = LIVE_REFRESH_MS) {
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const tick = () => {
      if (document.visibilityState === "visible") onTick();
    };
    timer = window.setInterval(tick, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") onTick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [onTick, enabled, intervalMs]);
}
