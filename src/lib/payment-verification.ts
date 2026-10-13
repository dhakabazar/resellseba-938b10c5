/** Only provider-verified fields or a stored checkout intent can bind a capture. */
export function assertPaymentBinding(opts: {
  orderNumber: string;
  verifiedOrderRef?: unknown;
  queriedIntent?: string;
  storedIntent?: string | null;
  suffixedOrderRef?: boolean;
}) {
  const reference = String(opts.verifiedOrderRef ?? "");
  const sameOrder = reference === opts.orderNumber ||
    (opts.suffixedOrderRef === true && new RegExp(`^${opts.orderNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[0-9]+$`).test(reference));
  const sameIntent = Boolean(opts.storedIntent && opts.queriedIntent === opts.storedIntent);
  if (!sameOrder && !sameIntent) throw new Error("Verified payment does not match this order");
}