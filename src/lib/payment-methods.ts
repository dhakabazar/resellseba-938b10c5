/**
 * Shared payment-method catalog.
 *
 * Two families, deliberately kept apart everywhere in the UI:
 * - manual  → mobile wallet / bank / cash. Customer (or reseller) sends money
 *             and types a TrxID; a human verifies it.
 * - api     → automatic gateways that confirm the payment themselves.
 *
 * Extra per-method options live in `payment_configs.config`:
 *   account        — the wallet/bank number shown to the payer
 *   account_type   — "Personal" / "Agent" / "Merchant" …
 *   allow_deposit  — reseller may use this method to pay the security deposit
 */
import { supabase } from "@/integrations/supabase/client";

export type PaymentMode = "manual" | "api";

export type PaymentMethodMeta = {
  value: string;
  label: string;
  mode: PaymentMode;
  hint: string;
};

export const MANUAL_METHODS: PaymentMethodMeta[] = [
  { value: "bkash", label: "bKash", mode: "manual", hint: "Send Money / Cash Out number" },
  { value: "nagad", label: "Nagad", mode: "manual", hint: "Send Money number" },
  { value: "rocket", label: "Rocket", mode: "manual", hint: "Send Money number" },
  { value: "other", label: "Bank / Cash / Other", mode: "manual", hint: "Bank account or cash handover" },
];

export const API_METHODS: PaymentMethodMeta[] = [
  { value: "sslcommerz", label: "SSLCommerz", mode: "api", hint: "Cards + all wallets (hosted checkout)" },
  { value: "eps", label: "EPS", mode: "api", hint: "EPS aggregator checkout" },
  { value: "eps", label: "aamarPay", mode: "api", hint: "aamarPay hosted checkout" },
  { value: "bkash", label: "bKash API", mode: "api", hint: "bKash PGW (tokenized checkout)" },
  { value: "nagad", label: "Nagad API", mode: "api", hint: "Nagad merchant checkout" },
  { value: "card", label: "Card gateway", mode: "api", hint: "Any card processor" },
];

/**
 * Credential schema per gateway, following each provider's own documentation.
 * The chosen gateway is stored in `config.gateway` because several providers
 * share the same payment_method enum value.
 */
export type GatewayField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  hint?: string;
};

export type GatewaySpec = {
  key: string;
  method: string;
  label: string;
  tagline: string;
  docs: string;
  fields: GatewayField[];
  /** Callback/IPN paths the provider must be pointed at. */
  callbacks?: string[];
};

export const GATEWAYS: GatewaySpec[] = [
  {
    key: "sslcommerz",
    method: "sslcommerz",
    label: "SSLCommerz",
    tagline: "Cards, all mobile wallets and net banking through one hosted checkout.",
    docs: "https://developer.sslcommerz.com/doc/v4/",
    fields: [
      { key: "store_id", label: "Store ID", placeholder: "yourstore0live", hint: "From SSLCommerz merchant panel → API/Integration" },
      { key: "store_passwd", label: "Store Password (API key)", placeholder: "yourstore0live@ssl", secret: true },
      { key: "currency", label: "Currency", placeholder: "BDT" },
    ],
    callbacks: ["/api/public/payments/sslcommerz/success", "/api/public/payments/sslcommerz/fail", "/api/public/payments/sslcommerz/cancel", "/api/public/payments/sslcommerz/ipn"],
  },
  {
    key: "eps",
    method: "eps",
    label: "EPS",
    tagline: "EPS aggregator — cards and wallets with a merchant hash.",
    docs: "https://epsdoc.com/",
    fields: [
      { key: "merchant_id", label: "Merchant ID", placeholder: "EPS123456" },
      { key: "username", label: "API username", placeholder: "eps_user" },
      { key: "password", label: "API password", secret: true },
      { key: "hash_key", label: "Hash / secret key", secret: true },
    ],
    callbacks: ["/api/public/payments/eps/callback"],
  },
  {
    key: "aamarpay",
    method: "eps",
    label: "aamarPay",
    tagline: "aamarPay hosted checkout with signature-key verification.",
    docs: "https://aamarpay.readme.io/",
    fields: [
      { key: "store_id", label: "Store ID", placeholder: "aamarpaytest" },
      { key: "signature_key", label: "Signature key", secret: true },
      { key: "currency", label: "Currency", placeholder: "BDT" },
    ],
    callbacks: ["/api/public/payments/aamarpay/callback"],
  },
  {
    key: "bkash",
    method: "bkash",
    label: "bKash API (PGW)",
    tagline: "Tokenized checkout — customer pays inside bKash, confirmed automatically.",
    docs: "https://developer.bka.sh/",
    fields: [
      { key: "app_key", label: "App key", secret: false },
      { key: "app_secret", label: "App secret", secret: true },
      { key: "username", label: "Merchant username", placeholder: "01700000000" },
      { key: "password", label: "Merchant password", secret: true },
    ],
    callbacks: ["/api/public/payments/bkash/callback"],
  },
  {
    key: "nagad",
    method: "nagad",
    label: "Nagad API",
    tagline: "Nagad merchant checkout signed with your RSA key pair.",
    docs: "https://nagad.com.bd/",
    fields: [
      { key: "merchant_id", label: "Merchant ID", placeholder: "68301111111" },
      { key: "merchant_number", label: "Merchant number", placeholder: "01700000000" },
      { key: "public_key", label: "Nagad public key", secret: true },
      { key: "private_key", label: "Merchant private key", secret: true },
    ],
    callbacks: ["/api/public/payments/nagad/callback"],
  },
  {
    key: "card",
    method: "card",
    label: "Card gateway",
    tagline: "Any other processor that takes an API key pair.",
    docs: "",
    fields: [
      { key: "api_key", label: "API key" },
      { key: "api_secret", label: "API secret", secret: true },
      { key: "base_url", label: "Base URL", placeholder: "https://api.provider.com" },
    ],
  },
];

export function gatewaySpec(method: string, gateway?: string): GatewaySpec {
  return (
    GATEWAYS.find((g) => g.key === (gateway || "")) ??
    GATEWAYS.find((g) => g.method === method) ??
    GATEWAYS[GATEWAYS.length - 1]!
  );
}


export function methodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  const found = [...MANUAL_METHODS, ...API_METHODS].find((m) => m.value === method);
  return found?.label ?? method;
}

export type PaymentConfigRow = {
  id: string;
  method: string;
  label: string;
  mode: PaymentMode;
  is_active: boolean;
  instructions: string | null;
  config: Record<string, unknown> | null;
};

export const cfgString = (config: PaymentConfigRow["config"], key: string): string => {
  const v = config?.[key];
  return typeof v === "string" ? v : "";
};

export const cfgBool = (config: PaymentConfigRow["config"], key: string): boolean => Boolean(config?.[key]);

/** Active platform-level manual methods the admin marked as deposit-friendly. */
export async function fetchDepositMethods(): Promise<PaymentConfigRow[]> {
  const { data } = await supabase
    .from("payment_configs")
    .select("id,method,label,mode,is_active,instructions,config")
    .is("reseller_id", null)
    .eq("is_active", true)
    .order("created_at");
  return ((data ?? []) as unknown as PaymentConfigRow[]).filter(
    (r) => r.mode === "manual" && cfgBool(r.config, "allow_deposit"),
  );
}
