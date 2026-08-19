ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'packaging';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_partial';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'partial_full';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'partial_item';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'partial_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'damaged';