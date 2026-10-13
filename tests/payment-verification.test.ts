import { expect, test } from "bun:test";
import { assertPaymentBinding } from "../src/lib/payment-verification";
test("verified order reference must match the order being credited", () => {
  expect(() => assertPaymentBinding({ orderNumber: "701066", verifiedOrderRef: "701066" })).not.toThrow();
  expect(() => assertPaymentBinding({ orderNumber: "701066", verifiedOrderRef: "701067" })).toThrow();
});
test("stored checkout intent binds a provider without an echoed order reference", () => {
  expect(() => assertPaymentBinding({ orderNumber: "701066", queriedIntent: "intent-A", storedIntent: "intent-A" })).not.toThrow();
  expect(() => assertPaymentBinding({ orderNumber: "701066", queriedIntent: "intent-B", storedIntent: "intent-A" })).toThrow();
  expect(() => assertPaymentBinding({ orderNumber: "701066", queriedIntent: "intent-A" })).toThrow();
});
test("provider suffixed references accept only the exact order plus numeric suffix", () => {
  expect(() => assertPaymentBinding({ orderNumber: "701066", verifiedOrderRef: "701066-12345", suffixedOrderRef: true })).not.toThrow();
  expect(() => assertPaymentBinding({ orderNumber: "701066", verifiedOrderRef: "7010667-12345", suffixedOrderRef: true })).toThrow();
});