/**
 * Automatic (redirect-based) payment gateway registry — client safe.
 *
 * One source of truth for: provider keys, labels, credential field mapping
 * (which admin field maps to which DB column), sandbox/live hosts, callback
 * URLs the provider panel must whitelist, and the query flag each gateway
 * appends when the browser comes back to the storefront.
 *
 * Credentials live per store in `payment_gateway_configs`
 * (api_key / api_secret / merchant_id / config jsonb) — never in code.
 */

export type GatewayFieldSpec = {
  /** where the value is stored: a real column, or a key inside config jsonb */
  path: "api_key" | "api_secret" | "merchant_id" | `config.${string}`;
  label: string;
  placeholder?: string;
  secret?: boolean;
  hint?: string;
  multiline?: boolean;
  required?: boolean;
};

export type GatewaySpec = {
  provider: string;
  label: string;
  tagline: string;
  docs: string;
  /** payment_method enum value stored on the order */
  method: string;
  hosts: { sandbox: string; live: string };
  fields: GatewayFieldSpec[];
  /** paths the provider panel must be pointed at (relative to site origin) */
  callbacks: string[];
  /** flag appended on the storefront return URL, e.g. ?sslcommerz=1 */
  returnFlag: string;
};

export const GATEWAYS: GatewaySpec[] = [
  {
    provider: "sslcommerz",
    label: "SSLCommerz",
    tagline: "Cards, all mobile wallets and net banking in one hosted checkout.",
    docs: "https://developer.sslcommerz.com/doc/v4/",
    method: "sslcommerz",
    hosts: { sandbox: "https://sandbox.sslcommerz.com", live: "https://securepay.sslcommerz.com" },
    fields: [
      { path: "api_key", label: "Store ID", placeholder: "yourstore0live", required: true, hint: "Merchant panel → API / Integration" },
      { path: "api_secret", label: "Store password", placeholder: "yourstore0live@ssl", secret: true, required: true },
    ],
    callbacks: ["/api/public/payment/sslcommerz/return", "/api/public/payment/sslcommerz-ipn"],
    returnFlag: "sslcommerz",
  },
  {
    provider: "bkash",
    label: "bKash (Tokenized Checkout)",
    tagline: "Customer pays inside bKash; payment is executed and confirmed automatically.",
    docs: "https://developer.bka.sh/",
    method: "bkash",
    hosts: { sandbox: "https://tokenized.sandbox.bka.sh/v1.2.0-beta", live: "https://tokenized.pay.bka.sh/v1.2.0-beta" },
    fields: [
      { path: "api_key", label: "App key", required: true },
      { path: "api_secret", label: "App secret", secret: true, required: true },
      { path: "merchant_id", label: "Merchant username", placeholder: "01700000000", required: true },
      { path: "config.password", label: "Merchant password", secret: true, required: true },
    ],
    callbacks: ["/api/public/payment/bkash/return"],
    returnFlag: "bkash",
  },
  {
    provider: "nagad",
    label: "Nagad",
    tagline: "Nagad merchant checkout signed and encrypted with your RSA key pair.",
    docs: "https://nagad.com.bd/",
    method: "nagad",
    hosts: { sandbox: "https://sandbox-ssl.mynagad.com:10443/api/dfs", live: "https://api.mynagad.com/api/dfs" },
    fields: [
      { path: "merchant_id", label: "Merchant ID", placeholder: "683002007104225", required: true },
      { path: "api_key", label: "Merchant number", placeholder: "01700000000", required: true },
      {
        path: "api_secret",
        label: "Merchant private key (PKCS8 base64)",
        secret: true,
        multiline: true,
        required: true,
        hint: "Raw base64 only — no PEM header/footer and no line breaks",
      },
      {
        path: "config.pg_public_key",
        label: "Nagad PG public key (base64)",
        secret: true,
        multiline: true,
        required: true,
        hint: "Raw base64 only — no PEM header/footer and no line breaks",
      },
    ],
    callbacks: ["/api/public/payment/nagad/return"],
    returnFlag: "nagad",
  },
  {
    provider: "shurjopay",
    label: "ShurjoPay",
    tagline: "ShurjoPay aggregator — cards and every wallet through one checkout.",
    docs: "https://docs.shurjopay.com.bd/",
    method: "shurjopay",
    hosts: { sandbox: "https://sandbox.shurjopayment.com/api", live: "https://engine.shurjopayment.com/api" },
    fields: [
      { path: "api_key", label: "Username", required: true },
      { path: "api_secret", label: "Password", secret: true, required: true },
      { path: "merchant_id", label: "Prefix", placeholder: "sp", required: true },
    ],
    callbacks: ["/api/public/payment/shurjopay/return"],
    returnFlag: "shurjopay",
  },
  {
    provider: "eps",
    label: "EPS",
    tagline: "EPS payment engine — token based initialize plus status check.",
    docs: "https://epsbd.com/",
    method: "eps",
    hosts: { sandbox: "https://sandbox-pgapi.eps.com.bd", live: "https://pgapi.eps.com.bd" },
    fields: [
      { path: "api_key", label: "Username", required: true },
      { path: "api_secret", label: "Password", secret: true, required: true },
      { path: "merchant_id", label: "Merchant ID (UUID)", required: true },
      { path: "config.store_id", label: "Store ID (UUID)", required: true },
    ],
    callbacks: ["/api/public/payment/eps/return"],
    returnFlag: "eps",
  },
  {
    provider: "aamarpay",
    label: "aamarPay",
    tagline: "aamarPay hosted checkout verified with the signature key.",
    docs: "https://aamarpay.readme.io/",
    method: "aamarpay",
    hosts: { sandbox: "https://sandbox.aamarpay.com", live: "https://secure.aamarpay.com" },
    fields: [
      { path: "api_key", label: "Store ID", placeholder: "aamarpaytest", required: true },
      { path: "api_secret", label: "Signature key", secret: true, required: true },
    ],
    callbacks: ["/api/public/payment/aamarpay/return"],
    returnFlag: "aamarpay",
  },
  {
    provider: "epayseba",
    label: "ePaySeba",
    tagline: "ePaySeba hosted checkout with webhook confirmation.",
    docs: "https://epayseba.com/",
    method: "epayseba",
    hosts: { sandbox: "https://sandbox.epayseba.com", live: "https://pay.epayseba.com" },
    fields: [
      { path: "api_key", label: "API key", secret: true, required: true },
      { path: "api_secret", label: "Secret key (webhook signature)", secret: true, hint: "Optional — used to verify webhooks" },
      { path: "merchant_id", label: "Brand key", required: true },
    ],
    callbacks: ["/api/public/payment/epayseba/return", "/api/public/payment/epayseba-webhook"],
    returnFlag: "epayseba",
  },
];

export const GATEWAY_PROVIDERS = GATEWAYS.map((g) => g.provider);

export function gatewayByProvider(provider: string): GatewaySpec | undefined {
  return GATEWAYS.find((g) => g.provider === provider);
}

export function isAutomaticGateway(method: string | null | undefined): boolean {
  if (!method) return false;
  return GATEWAYS.some((g) => g.method === method);
}

export function gatewayLabel(provider: string): string {
  return gatewayByProvider(provider)?.label ?? provider;
}

/** Reads the return flag the gateway appended, e.g. ?shurjopay=1&status=paid */
export function detectReturnGateway(search: URLSearchParams | Record<string, unknown>): string | null {
  const has = (k: string) =>
    search instanceof URLSearchParams ? search.has(k) : Object.prototype.hasOwnProperty.call(search, k);
  for (const g of GATEWAYS) if (has(g.returnFlag)) return g.provider;
  return null;
}

/** Turns provider/HTML noise into a short, user-friendly message. */
export function extractGatewayError(raw: unknown): string {
  const text = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : String(raw ?? "");
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "Payment could not be started. Please try again.";
  if (/request rejected|access denied|forbidden/i.test(clean))
    return "Gateway rejected the request. Please try another payment method.";
  if (/timeout|timed out|aborted/i.test(clean))
    return "Gateway did not respond in time. Please try again or choose another method.";
  return clean.slice(0, 220);
}
