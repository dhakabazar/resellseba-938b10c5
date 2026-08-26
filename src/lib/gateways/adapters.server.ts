// Server-only gateway adapters. One object per provider with the identical
// contract: create (hosted payment URL), verifyReturn (server-side verification
// of what actually happened), test (credential check for the admin UI).
import {
  formPost,
  getJson,
  jsonPost,
  withTimeout,
  type GatewayCreds,
  type GatewayOrder,
} from "./core.server";

export type CreateUrls = {
  /** edge/return endpoint the gateway must call */
  returnUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
};

export type CreateResult = { paymentUrl: string; ref?: string };
export type VerifyResult = { paid: boolean; amount: number; txnId: string; cancelled?: boolean; note?: string };

export type Adapter = {
  create: (creds: GatewayCreds, order: GatewayOrder, urls: CreateUrls) => Promise<CreateResult>;
  verifyReturn: (creds: GatewayCreds, order: GatewayOrder, params: Record<string, string>) => Promise<VerifyResult>;
  test: (creds: GatewayCreds) => Promise<void>;
};

const fail = (msg: string) => {
  throw new Error(msg);
};

const num = (v: unknown) => Number(String(v ?? "0").replace(/[^0-9.\-]/g, "")) || 0;

/* ------------------------------------------------------------------ SSLCommerz */
const sslcommerz: Adapter = {
  async create(c, order, urls) {
    if (!c.api_key || !c.api_secret) fail("SSLCommerz store ID / password missing");
    const body = new URLSearchParams({
      store_id: c.api_key,
      store_passwd: c.api_secret,
      total_amount: String(Number(order.total)),
      currency: "BDT",
      tran_id: order.order_number,
      success_url: urls.returnUrl,
      fail_url: urls.failUrl,
      cancel_url: urls.cancelUrl,
      ipn_url: urls.ipnUrl,
      cus_name: order.customer_name,
      cus_email: order.customer_email || "noreply@example.com",
      cus_phone: order.customer_phone,
      cus_add1: order.address_line,
      cus_city: order.city || "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "Courier",
      product_name: `Order ${order.order_number}`,
      product_category: "General",
      product_profile: "general",
      value_a: order.order_number,
    });
    const res = await withTimeout((signal) => formPost(`${c.base}/gwprocess/v4/api.php`, body, signal));
    if (res.status !== "SUCCESS" || !res.GatewayPageURL)
      fail(res.failedreason || res.__raw || "SSLCommerz session failed");
    return { paymentUrl: res.GatewayPageURL as string };
  },
  async verifyReturn(c, order, p) {
    const status = (p.status || "").toUpperCase();
    if (status === "CANCELLED" || status === "FAILED")
      return { paid: false, amount: 0, txnId: p.bank_tran_id || "", cancelled: status === "CANCELLED" };
    const valId = p.val_id || "";
    if (valId) {
      const url = `${c.base}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(c.api_key)}&store_passwd=${encodeURIComponent(c.api_secret)}&format=json`;
      const v = await getJson(url);
      const ok = v.status === "VALID" || v.status === "VALIDATED";
      return { paid: ok, amount: num(v.amount), txnId: String(v.bank_tran_id || v.tran_id || "") };
    }
    return sslQuery(c, order.order_number);
  },
  async test(c) {
    const v = await sslQuery(c, `test-${Date.now()}`);
    void v;
  },
};

async function sslQuery(c: GatewayCreds, tranId: string): Promise<VerifyResult> {
  const url = `${c.base}/validator/api/merchantTransIDvalidationAPI.php?tran_id=${encodeURIComponent(tranId)}&store_id=${encodeURIComponent(c.api_key)}&store_passwd=${encodeURIComponent(c.api_secret)}&format=json`;
  const r = await withTimeout((signal) => getJson(url, {}, signal));
  if (r.APIConnect && r.APIConnect !== "DONE") fail(`SSLCommerz: ${r.APIConnect}`);
  const el = Array.isArray(r.element) ? r.element[0] : null;
  if (!el) return { paid: false, amount: 0, txnId: "" };
  const ok = el.status === "VALID" || el.status === "VALIDATED";
  return { paid: ok, amount: num(el.store_amount || el.amount), txnId: String(el.bank_tran_id || tranId) };
}

/* ------------------------------------------------------------------- bKash */
async function bkashToken(c: GatewayCreds, signal?: AbortSignal) {
  const r = await jsonPost(
    `${c.base}/tokenized/checkout/token/grant`,
    { app_key: c.api_key, app_secret: c.api_secret },
    { username: c.merchant_id, password: String(c.config.password ?? "") },
    signal,
  );
  if (!r.id_token) fail(r.statusMessage || r.msg || "bKash authentication failed");
  return r.id_token as string;
}

const bkash: Adapter = {
  async create(c, order, urls) {
    if (!c.api_key || !c.api_secret || !c.merchant_id || !c.config.password) fail("bKash credentials missing");
    return withTimeout(async (signal) => {
      const token = await bkashToken(c, signal);
      const r = await jsonPost(
        `${c.base}/tokenized/checkout/create`,
        {
          mode: "0011",
          payerReference: order.customer_phone,
          callbackURL: urls.returnUrl,
          amount: Number(order.total).toFixed(2),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: order.order_number,
        },
        { authorization: token, "x-app-key": c.api_key },
        signal,
      );
      if (!r.bkashURL) fail(r.statusMessage || "bKash checkout create failed");
      return { paymentUrl: r.bkashURL as string, ref: String(r.paymentID ?? "") };
    });
  },
  async verifyReturn(c, order, p) {
    const paymentID = p.paymentID || order.transaction_id || "";
    const status = (p.status || "").toLowerCase();
    if (!paymentID) return { paid: false, amount: 0, txnId: "" };
    if (status === "cancel" || status === "failure")
      return { paid: false, amount: 0, txnId: paymentID, cancelled: status === "cancel" };
    const token = await bkashToken(c);
    const headers = { authorization: token, "x-app-key": c.api_key };
    let r = await jsonPost(`${c.base}/tokenized/checkout/execute`, { paymentID }, headers);
    if (!r.trxID) {
      // fallback: already executed, or execute raced with the customer
      r = await jsonPost(`${c.base}/tokenized/checkout/payment/status`, { paymentID }, headers);
    }
    const paid = String(r.transactionStatus ?? "").toLowerCase() === "completed" && Boolean(r.trxID);
    return { paid, amount: num(r.amount), txnId: String(r.trxID || paymentID), note: r.statusMessage };
  },
  async test(c) {
    await withTimeout((signal) => bkashToken(c, signal));
  },
};

/* ------------------------------------------------------------------- Nagad */
async function nagadCrypto() {
  const crypto = await import("node:crypto");
  const pem = (b64: string, kind: "PUBLIC" | "PRIVATE") =>
    `-----BEGIN ${kind} KEY-----\n${b64.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n")}\n-----END ${kind} KEY-----`;
  return {
    encrypt: (data: string, pubB64: string) =>
      crypto
        .publicEncrypt(
          { key: pem(pubB64, "PUBLIC"), padding: crypto.constants.RSA_PKCS1_PADDING },
          Buffer.from(data),
        )
        .toString("base64"),
    decrypt: (b64: string, privB64: string) =>
      crypto
        .privateDecrypt(
          { key: pem(privB64, "PRIVATE"), padding: crypto.constants.RSA_PKCS1_PADDING },
          Buffer.from(b64, "base64"),
        )
        .toString(),
    sign: (data: string, privB64: string) =>
      crypto.createSign("SHA256").update(data).sign(pem(privB64, "PRIVATE"), "base64"),
  };
}

const nagadHeaders = {
  "X-KM-Api-Version": "v-0.2.0",
  "X-KM-IP-V4": "103.100.200.100",
  "X-KM-Client-Type": "PC_WEB",
};

const nagad: Adapter = {
  async create(c, order, urls) {
    if (!c.merchant_id || !c.api_secret || !c.config.pg_public_key) fail("Nagad credentials missing");
    const { encrypt, decrypt, sign } = await nagadCrypto();
    const pgKey = String(c.config.pg_public_key);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const orderId = `${order.order_number}-${now.getTime().toString().slice(-5)}`;
    return withTimeout(async (signal) => {
      const initPlain = JSON.stringify({
        merchantId: c.merchant_id,
        datetime: dt,
        orderId,
        challenge: Math.random().toString(36).slice(2, 12),
      });
      const init = await jsonPost(
        `${c.base}/check-out/initialize/${c.merchant_id}/${orderId}`,
        {
          accountNumber: c.api_key,
          dateTime: dt,
          sensitiveData: encrypt(initPlain, pgKey),
          signature: sign(initPlain, c.api_secret),
        },
        nagadHeaders,
        signal,
      );
      if (!init.sensitiveData || !init.signature) fail(init.message || init.reason || "Nagad initialize failed");
      const decoded = JSON.parse(decrypt(String(init.sensitiveData), c.api_secret)) as {
        paymentReferenceId: string;
        challenge: string;
      };
      const completePlain = JSON.stringify({
        merchantId: c.merchant_id,
        orderId,
        currencyCode: "050",
        amount: String(Number(order.total).toFixed(2)),
        challenge: decoded.challenge,
      });
      const complete = await jsonPost(
        `${c.base}/check-out/complete/${decoded.paymentReferenceId}`,
        {
          sensitiveData: encrypt(completePlain, pgKey),
          signature: sign(completePlain, c.api_secret),
          merchantCallbackURL: urls.returnUrl,
          additionalMerchantInfo: { orderNumber: order.order_number },
        },
        nagadHeaders,
        signal,
      );
      if (String(complete.status).toLowerCase() !== "success" || !complete.callBackUrl)
        fail(complete.message || complete.reason || "Nagad checkout failed");
      return { paymentUrl: String(complete.callBackUrl), ref: decoded.paymentReferenceId };
    });
  },
  async verifyReturn(c, order, p) {
    const ref = p.payment_ref_id || p.paymentRefId || order.transaction_id || "";
    const status = (p.status || "").toLowerCase();
    if (!ref) return { paid: false, amount: 0, txnId: "", cancelled: status === "cancelled" };
    const v = await getJson(`${c.base}/verify/payment/${encodeURIComponent(ref)}`, nagadHeaders);
    const paid = String(v.status ?? "").toLowerCase() === "success";
    return { paid, amount: num(v.amount), txnId: String(v.issuerPaymentRefNo || ref), note: v.statusCode };
  },
  async test(c) {
    if (!c.merchant_id || !c.api_secret || !c.config.pg_public_key) fail("Nagad credentials missing");
    const { encrypt, sign } = await nagadCrypto();
    // keys must load and be usable; a bad base64/format throws here
    encrypt("ping", String(c.config.pg_public_key));
    sign("ping", c.api_secret);
    const v = await withTimeout((signal) =>
      getJson(`${c.base}/verify/payment/test-connection`, nagadHeaders, signal),
    );
    if (v.__status && v.__status >= 500) fail("Nagad server unreachable");
  },
};

/* --------------------------------------------------------------- ShurjoPay */
async function shurjoToken(c: GatewayCreds, signal?: AbortSignal) {
  const r = await jsonPost(`${c.base}/get_token`, { username: c.api_key, password: c.api_secret }, {}, signal);
  if (!r.token) fail(r.message || "ShurjoPay authentication failed");
  return r as { token: string; store_id: string; execute_url: string; token_type: string };
}

const shurjopay: Adapter = {
  async create(c, order, urls) {
    if (!c.api_key || !c.api_secret) fail("ShurjoPay username / password missing");
    return withTimeout(async (signal) => {
      const t = await shurjoToken(c, signal);
      const r = await jsonPost(
        `${c.base}/secret-pay`,
        {
          prefix: c.merchant_id || "sp",
          token: t.token,
          store_id: t.store_id,
          amount: Number(order.total),
          order_id: order.order_number,
          currency: "BDT",
          customer_name: order.customer_name,
          customer_address: order.address_line,
          customer_phone: order.customer_phone,
          customer_city: order.city || "Dhaka",
          customer_email: order.customer_email || "noreply@example.com",
          customer_post_code: "1000",
          client_ip: "103.100.200.100",
          return_url: urls.returnUrl,
          cancel_url: urls.cancelUrl,
        },
        { authorization: `Bearer ${t.token}` },
        signal,
      );
      if (!r.checkout_url) fail(r.message || r.sp_message || "ShurjoPay checkout failed");
      return { paymentUrl: String(r.checkout_url), ref: String(r.sp_order_id ?? "") };
    });
  },
  async verifyReturn(c, order, p) {
    const spOrderId = p.order_id || p.sp_order_id || order.transaction_id || "";
    if (!spOrderId) return { paid: false, amount: 0, txnId: "" };
    const t = await shurjoToken(c);
    const r = await jsonPost(
      `${c.base}/verification`,
      { order_id: spOrderId },
      { authorization: `Bearer ${t.token}` },
    );
    const row = Array.isArray(r) ? r[0] : r;
    const code = String(row?.sp_code ?? "");
    return {
      paid: code === "1000",
      amount: num(row?.received_amount ?? row?.amount),
      txnId: String(row?.bank_trx_id || spOrderId),
      cancelled: code === "1002",
      note: row?.sp_message,
    };
  },
  async test(c) {
    await withTimeout((signal) => shurjoToken(c, signal));
  },
};

/* --------------------------------------------------------------------- EPS */
async function epsToken(c: GatewayCreds, signal?: AbortSignal) {
  const r = await jsonPost(`${c.base}/v1/Auth/GetToken`, { userName: c.api_key, password: c.api_secret }, {}, signal);
  const token = r.token || r.Token || r.data?.token;
  if (!token) fail(r.message || r.Message || "EPS authentication failed");
  return String(token);
}

const eps: Adapter = {
  async create(c, order, urls) {
    if (!c.api_key || !c.api_secret || !c.merchant_id || !c.config.store_id) fail("EPS credentials missing");
    return withTimeout(async (signal) => {
      const token = await epsToken(c, signal);
      const merchantTransactionId = `${order.order_number}-${Date.now().toString().slice(-6)}`;
      const r = await jsonPost(
        `${c.base}/v1/EPSEngine/InitializeEPS`,
        {
          storeId: c.config.store_id,
          merchantId: c.merchant_id,
          CustomerOrderId: order.order_number,
          merchantTransactionId,
          successUrl: urls.returnUrl,
          failUrl: urls.failUrl,
          cancelUrl: urls.cancelUrl,
          transactionAmount: Number(order.total),
          customerName: order.customer_name,
          customerEmail: order.customer_email || "noreply@example.com",
          customerPhone: order.customer_phone,
          customerAddress: order.address_line,
        },
        { authorization: `Bearer ${token}` },
        signal,
      );
      const url = r.RedirectURL || r.redirectURL || r.redirectUrl || r.data?.RedirectURL;
      if (!url) fail(r.message || r.Message || "EPS initialize failed");
      return { paymentUrl: String(url), ref: merchantTransactionId };
    });
  },
  async verifyReturn(c, order, p) {
    const txn = p.merchantTransactionId || p.MerchantTransactionId || order.transaction_id || "";
    if (!txn) return { paid: false, amount: 0, txnId: "" };
    const token = await epsToken(c);
    const r = await jsonPost(
      `${c.base}/v1/EPSEngine/CheckMerchantTransactionStatus`,
      { merchantTransactionId: txn, merchantId: c.merchant_id, storeId: c.config.store_id },
      { authorization: `Bearer ${token}` },
    );
    const status = String(r.transactionStatus ?? r.TransactionStatus ?? r.status ?? "").toLowerCase();
    return {
      paid: status.includes("success") || status === "paid" || status === "completed",
      amount: num(r.transactionAmount ?? r.TransactionAmount ?? r.amount),
      txnId: String(r.bankTransactionId ?? r.epsTransactionId ?? txn),
      cancelled: status.includes("cancel"),
      note: r.message ?? r.Message,
    };
  },
  async test(c) {
    await withTimeout((signal) => epsToken(c, signal));
  },
};

/* ---------------------------------------------------------------- aamarPay */
const aamarpay: Adapter = {
  async create(c, order, urls) {
    if (!c.api_key || !c.api_secret) fail("aamarPay store ID / signature key missing");
    const r = await withTimeout((signal) =>
      jsonPost(
        `${c.base}/jsonpost.php`,
        {
          store_id: c.api_key,
          signature_key: c.api_secret,
          tran_id: order.order_number,
          amount: Number(order.total).toFixed(2),
          currency: "BDT",
          desc: `Order ${order.order_number}`,
          cus_name: order.customer_name,
          cus_email: order.customer_email || "noreply@example.com",
          cus_phone: order.customer_phone,
          cus_add1: order.address_line,
          cus_city: order.city || "Dhaka",
          cus_country: "Bangladesh",
          success_url: urls.returnUrl,
          fail_url: urls.failUrl,
          cancel_url: urls.cancelUrl,
          type: "json",
        },
        {},
        signal,
      ),
    );
    const path = r.payment_url || r.paymentUrl;
    if (!path) fail(r.result === "false" ? String(r.__raw ?? "aamarPay init failed") : String(r.__raw ?? r.message ?? "aamarPay init failed"));
    const url = String(path).startsWith("http") ? String(path) : `${c.base}${path}`;
    return { paymentUrl: url };
  },
  async verifyReturn(c, order, p) {
    const tranId = p.mer_txnid || p.tran_id || order.order_number;
    const r = await getJson(
      `${c.base}/api/v1/trxcheck/request.php?request_id=${encodeURIComponent(tranId)}&store_id=${encodeURIComponent(c.api_key)}&signature_key=${encodeURIComponent(c.api_secret)}&type=json`,
    );
    const row = Array.isArray(r) ? r[0] : r;
    const status = String(row?.pay_status ?? row?.status_code ?? "").toLowerCase();
    return {
      paid: status === "successful" || status === "2",
      amount: num(row?.amount ?? row?.pay_amount),
      txnId: String(row?.bank_txn ?? row?.pg_txnid ?? tranId),
      cancelled: status.includes("cancel"),
      note: row?.pay_status,
    };
  },
  async test(c) {
    if (!c.api_key || !c.api_secret) fail("aamarPay store ID / signature key missing");
    const r = await withTimeout((signal) =>
      getJson(
        `${c.base}/api/v1/trxcheck/request.php?request_id=test-connection&store_id=${encodeURIComponent(c.api_key)}&signature_key=${encodeURIComponent(c.api_secret)}&type=json`,
        {},
        signal,
      ),
    );
    const row = Array.isArray(r) ? r[0] : r;
    const msg = String(row?.msg ?? row?.message ?? "");
    if (/invalid|unauthor|not found store|signature/i.test(msg)) fail(`aamarPay: ${msg}`);
  },
};

/* ---------------------------------------------------------------- ePaySeba */
/**
 * Docs: https://epayseba.com/developers/docs (section 2 & 3)
 * Live base: https://pay.epayseba.com
 *
 * Verified against the live API: the value the merchant panel accepts in the
 * `API-KEY` header is the **Brand key** (the account "Api Key" shown on the
 * brand card is rejected with `{"status":0,"message":"Invalid API Request."}`).
 * So every call tries each saved key in turn — brand key first — and uses the
 * first one the gateway accepts. That way it works no matter which field the
 * admin pasted the value into.
 */
function epaysebaKeys(c: GatewayCreds): string[] {
  const raw = [c.merchant_id, String(c.config.brand_key ?? ""), c.api_key, c.api_secret]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return [...new Set(raw)];
}

const epaysebaRejected = (r: Record<string, any>) =>
  r.__status === 404 || r.__status === 401 || r.__status === 403 || /invalid api request/i.test(String(r.message ?? ""));

/** Calls an ePaySeba endpoint with each saved key until one is accepted. */
async function epaysebaCall(
  c: GatewayCreds,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, any>> {
  const keys = epaysebaKeys(c);
  if (keys.length === 0) fail("ePaySeba API key (Brand key) is required");
  let last: Record<string, any> = {};
  for (const key of keys) {
    last = await jsonPost(`${c.base}${path}`, body, { "API-KEY": key }, signal);
    if (!epaysebaRejected(last)) return last;
  }
  return last;
}

function epaysebaError(r: Record<string, any>): string {
  const msg = String((r.message ?? r.error ?? "") || "");
  if (/invalid api request/i.test(msg) || r.__status === 404)
    return "ePaySeba: Invalid API Request — ePaySeba প্যানেলের Brand Setting থেকে ব্র্যান্ডের **Brand Key** কপি করে API key ফিল্ডে বসান (account Api Key কাজ করে না)।";
  return msg;
}

function epaysebaTxn(p: Record<string, string>, order: { transaction_id?: string | null; order_number: string }) {
  return (
    p.transactionId ||
    p.transaction_id ||
    p.trxId ||
    p.trx_id ||
    order.transaction_id ||
    order.order_number
  );
}

const epayseba: Adapter = {
  async create(c, order, urls) {
    const meta = {
      order_id: order.order_number,
      name: order.customer_name,
      phone: order.customer_phone,
    };
    const r = await withTimeout((signal) =>
      epaysebaCall(
        c,
        "/api/payment/create",
        {
          cus_name: order.customer_name || "Customer",
          cus_email: order.customer_email || "noreply@example.com",
          amount: String(Number(order.total)),
          success_url: urls.returnUrl,
          cancel_url: urls.cancelUrl,
          webhook_url: urls.ipnUrl,
          metadata: meta,
          meta_data: meta,
        },
        signal,
      ),
    );
    const url = r.payment_url || r.data?.payment_url || r.checkout_url;
    if (!url)
      fail(
        epaysebaError(r) ||
          (r.__raw
            ? `ePaySeba did not accept the request (HTTP ${r.__status}). Check the API key and base URL.`
            : "ePaySeba checkout failed"),
      );
    return { paymentUrl: String(url), ref: String(r.transaction_id ?? r.data?.transaction_id ?? "") };
  },
  async verifyReturn(c, order, p) {
    const id = epaysebaTxn(p, order);
    const r = await epaysebaCall(c, "/api/payment/verify", { transaction_id: id });
    const row = r.data ?? r;
    const status = String(row?.status ?? "").toLowerCase();
    const returned = String(p.status ?? "").toLowerCase();
    return {
      paid: status === "completed" || status === "success" || status === "paid",
      amount: num(row?.amount ?? row?.paymentAmount ?? p.paymentAmount),
      txnId: String(row?.transaction_id ?? id),
      cancelled:
        status.includes("cancel") ||
        status === "failed" ||
        returned.includes("cancel") ||
        returned === "failed",
      note: row?.message,
    };
  },
  async test(c) {
    const r = await withTimeout((signal) =>
      epaysebaCall(c, "/api/payment/verify", { transaction_id: "test-connection" }, signal),
    );
    if (epaysebaRejected(r)) fail(epaysebaError(r) || "ePaySeba rejected the API key");
    if (r.__raw)
      fail(
        `ePaySeba API not found at ${c.base} (HTTP ${r.__status}). Copy the exact API base URL from your ePaySeba merchant panel.`,
      );
  },
};


export const ADAPTERS: Record<string, Adapter> = {
  sslcommerz,
  bkash,
  nagad,
  shurjopay,
  eps,
  aamarpay,
  epayseba,
};

export function adapterFor(provider: string): Adapter {
  const a = ADAPTERS[provider];
  if (!a) throw new Error(`Unsupported gateway: ${provider}`);
  return a;
}
