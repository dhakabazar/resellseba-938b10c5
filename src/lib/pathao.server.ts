import type { Cfg } from "@/lib/couriers.server";

/** Pathao Courier Merchant API — production only (same policy as Steadfast/Carrybee). */
export const PATHAO_PRODUCTION_URL = "https://api-hermes.pathao.com";

export function pathaoBase(_conf: Cfg) {
  return PATHAO_PRODUCTION_URL;
}

type TokenBody = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  message?: string;
};

async function issueToken(conf: Cfg, body: Record<string, unknown>): Promise<TokenBody> {
  const res = await fetch(`${pathaoBase(conf)}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok || !parsed?.access_token) {
    console.error(`Pathao issue-token failed [${res.status}]: ${text}`);
    return {};
  }
  return parsed as TokenBody;
}

/**
 * Get a valid Pathao access token. The token (and refresh token) is persisted in
 * `courier_configs.config` so it is reused across requests; it is refreshed with
 * the refresh_token grant and only falls back to a full password grant.
 */
export async function pathaoAccessToken(db: any, conf: Cfg): Promise<string> {
  const { client_id, client_secret, username, password } = conf;
  if (!client_id || !client_secret || !username || !password)
    throw new Response("Missing Pathao credentials (Client ID / Secret / Username / Password)", {
      status: 400,
    });

  const expiresAt = Number(conf.token_expires_at ?? 0);
  // keep a 5 minute safety window
  if (conf.access_token && expiresAt > Date.now() + 5 * 60 * 1000) return conf.access_token;

  let token: TokenBody = {};
  if (conf.refresh_token) {
    token = await issueToken(conf, {
      client_id,
      client_secret,
      grant_type: "refresh_token",
      refresh_token: conf.refresh_token,
    });
  }
  if (!token.access_token) {
    token = await issueToken(conf, {
      client_id,
      client_secret,
      grant_type: "password",
      username,
      password,
    });
  }
  if (!token.access_token) throw new Response("Pathao auth failed", { status: 502 });

  const nextConfig: Cfg = {
    ...conf,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? conf.refresh_token ?? "",
    token_expires_at: String(Date.now() + Number(token.expires_in ?? 432000) * 1000),
  };
  await db.from("courier_configs").update({ config: nextConfig }).eq("provider", "pathao");

  // mutate the in-memory copy so later calls in the same request reuse it
  conf.access_token = nextConfig.access_token!;
  conf.refresh_token = nextConfig.refresh_token!;
  conf.token_expires_at = nextConfig.token_expires_at!;
  return token.access_token;
}

export async function pathaoRequest(db: any, conf: Cfg, path: string, init?: RequestInit) {
  const token = await pathaoAccessToken(db, conf);
  const res = await fetch(`${pathaoBase(conf)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    console.error(`Pathao ${path} failed [${res.status}]: ${text}`);
    const errors = body?.errors ? ` ${JSON.stringify(body.errors)}` : "";
    throw new Response(`${body?.message || `Pathao request failed (${res.status})`}${errors}`, {
      status: res.status === 422 || res.status === 400 ? 400 : 502,
    });
  }
  return body;
}

/** Merchant stores (store_id needed for booking). */
export async function pathaoStoreList(db: any, conf: Cfg) {
  const body = await pathaoRequest(db, conf, "/aladdin/api/v1/stores");
  return (body?.data?.data ?? []).map((s: any) => ({
    id: String(s.store_id),
    name: String(s.store_name ?? ""),
    address: String(s.store_address ?? ""),
    isActive: Number(s.is_active ?? 0) === 1,
    cityId: s.city_id ? Number(s.city_id) : null,
    zoneId: s.zone_id ? Number(s.zone_id) : null,
  }));
}

export async function pathaoCities(db: any, conf: Cfg) {
  const body = await pathaoRequest(db, conf, "/aladdin/api/v1/city-list");
  return (body?.data?.data ?? []).map((c: any) => ({
    id: Number(c.city_id),
    name: String(c.city_name ?? ""),
  }));
}

export async function pathaoZones(db: any, conf: Cfg, cityId: number) {
  const body = await pathaoRequest(db, conf, `/aladdin/api/v1/cities/${cityId}/zone-list`);
  return (body?.data?.data ?? []).map((z: any) => ({
    id: Number(z.zone_id),
    name: String(z.zone_name ?? ""),
  }));
}

export async function pathaoAreas(db: any, conf: Cfg, zoneId: number) {
  const body = await pathaoRequest(db, conf, `/aladdin/api/v1/zones/${zoneId}/area-list`);
  return (body?.data?.data ?? []).map((a: any) => ({
    id: Number(a.area_id),
    name: String(a.area_name ?? "").trim(),
    homeDelivery: Boolean(a.home_delivery_available),
    pickup: Boolean(a.pickup_available),
  }));
}

/** Price plan for a parcel (used to preview delivery fee before booking). */
export async function pathaoPricePlanRequest(
  db: any,
  conf: Cfg,
  args: { storeId: string | number; cityId: number; zoneId: number; itemWeight?: number; deliveryType?: number },
) {
  const body = await pathaoRequest(db, conf, "/aladdin/api/v1/merchant/price-plan", {
    method: "POST",
    body: JSON.stringify({
      store_id: String(args.storeId),
      item_type: 2,
      delivery_type: args.deliveryType ?? 48,
      item_weight: args.itemWeight ?? 0.5,
      recipient_city: args.cityId,
      recipient_zone: args.zoneId,
    }),
  });
  const d = body?.data ?? {};
  return {
    price: Number(d.price ?? 0),
    discount: Number(d.discount ?? 0),
    codPercentage: Number(d.cod_percentage ?? 0),
    additionalCharge: Number(d.additional_charge ?? 0),
    finalPrice: Number(d.final_price ?? d.price ?? 0),
  };
}

/** Short info for a consignment — used by manual status sync. */
export async function pathaoOrderInfo(db: any, conf: Cfg, consignmentId: string) {
  const body = await pathaoRequest(
    db,
    conf,
    `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`,
  );
  const d = body?.data ?? {};
  return {
    consignmentId: String(d.consignment_id ?? consignmentId),
    merchantOrderId: d.merchant_order_id ? String(d.merchant_order_id) : null,
    status: String(d.order_status_slug ?? d.order_status ?? "unknown"),
    invoiceId: d.invoice_id ? String(d.invoice_id) : null,
    updatedAt: d.updated_at ? String(d.updated_at) : null,
  };
}
