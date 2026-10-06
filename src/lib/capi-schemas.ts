import { z } from "zod";

export const pageViewInput = z.object({
  code: z.string().min(1),
  eventId: z.string().min(1),
  url: z.string().optional(),
  origin: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  ttp: z.string().optional(),
  userAgent: z.string().optional(),
});

export const viewContentInput = z.object({
  code: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  price: z.coerce.number(),
  eventId: z.string().min(1),
  origin: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  ttp: z.string().optional(),
  userAgent: z.string().optional(),
});

export const initiateCheckoutInput = z.object({
  code: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.coerce.number(),
      qty: z.coerce.number(),
    }),
  ),
  total: z.coerce.number(),
  eventId: z.string().min(1),
  origin: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  ttp: z.string().optional(),
  userAgent: z.string().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
});

export const purchaseInput = z.object({
  orderNumber: z.string().min(1),
  code: z.string().optional(),
  eventId: z.string().optional(),
  origin: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  ttp: z.string().optional(),
  userAgent: z.string().optional(),
});
