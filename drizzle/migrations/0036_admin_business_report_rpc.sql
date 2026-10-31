CREATE OR REPLACE FUNCTION public.admin_business_report(_from_ts bigint DEFAULT NULL, _to_ts bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
 v_from timestamptz := CASE WHEN _from_ts IS NULL THEN NULL ELSE to_timestamp(_from_ts / 1000.0) END;
 v_to timestamptz := CASE WHEN _to_ts IS NULL THEN NULL ELSE to_timestamp(_to_ts / 1000.0) END;
 v_orders jsonb; v_products jsonb; v_resellers jsonb; v_agents jsonb; v_expenses jsonb;
BEGIN
 IF NOT public.has_any_permission(auth.uid(), '{reports.view,finance.view,dashboard.view,orders.view}'::text[]) THEN
   RAISE EXCEPTION 'not authorized';
 END IF;

 WITH so AS MATERIALIZED (
   SELECT o.* FROM public.orders o
   WHERE (v_from IS NULL OR o.created_at >= v_from) AND (v_to IS NULL OR o.created_at <= v_to)
 ),
 it AS (
   SELECT i.order_id, jsonb_agg(jsonb_build_object('id',i.id,'order_id',i.order_id,'product_id',i.product_id,'product_name',i.product_name,
     'quantity',i.quantity,'returned_qty',i.returned_qty,'sa_price',i.sa_price,'line_total',i.line_total,'profit',i.profit,
     'buying_price',i.buying_price,'packaging_cost',i.packaging_cost)) AS items
   FROM public.order_items i JOIN so ON so.id = i.order_id GROUP BY i.order_id
 ),
 sh AS (
   SELECT s.order_id, jsonb_agg(jsonb_build_object('id',s.id,'order_id',s.order_id,'provider',s.provider,'cost',s.cost,
     'tracking_id',s.tracking_id,'consignment_id',s.consignment_id,'status',s.status)) AS ships
   FROM public.shipments s JOIN so ON so.id = s.order_id GROUP BY s.order_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',o.id,'order_number',o.order_number,'reseller_id',o.reseller_id,'status',o.status,'created_at',o.created_at,
   'customer_name',o.customer_name,'customer_phone',o.customer_phone,'address_line',o.address_line,'area',o.area,
   'subtotal',o.subtotal,'shipping_cost',o.shipping_cost,'total',o.total,'sa_cost_total',o.sa_cost_total,'reseller_profit',o.reseller_profit,
   'received_amount',o.received_amount,'packaging_total',o.packaging_total,'delivery_cost',o.delivery_cost,'advance_amount',o.advance_amount,
   'advance_by',o.advance_by,'is_exchange',o.is_exchange,'exchange_admin_share',o.exchange_admin_share,'exchange_admin_buy',o.exchange_admin_buy,
   'rider_status',o.rider_status,
   'resellers',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('business_name',r.business_name,'code',r.code) END,
   'order_items',coalesce(it.items,'[]'::jsonb),'shipments',coalesce(sh.ships,'[]'::jsonb)
 ) ORDER BY o.created_at DESC), '[]'::jsonb) INTO v_orders
 FROM so o LEFT JOIN public.resellers r ON r.id = o.reseller_id
 LEFT JOIN it ON it.order_id = o.id LEFT JOIN sh ON sh.order_id = o.id;

 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'product_code',p.product_code,'buying_price',p.buying_price,
   'packaging_cost',p.packaging_cost,'og_image_url',p.og_image_url)),'[]'::jsonb) INTO v_products FROM public.products p;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'business_name',r.business_name,'code',r.code,'agent_id',r.agent_id,
   'avatar_url',r.avatar_url,'status',r.status)),'[]'::jsonb) INTO v_resellers FROM public.resellers r;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'display_name',a.display_name,'sale_target',a.sale_target,'commission_rate',a.commission_rate,
   'commission_mode',a.commission_mode,'commission_per_unit',a.commission_per_unit,'is_active',a.is_active)),'[]'::jsonb) INTO v_agents FROM public.agents a;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.spent_on DESC),'[]'::jsonb) INTO v_expenses FROM public.expenses e
   WHERE (v_from IS NULL OR e.spent_on >= (v_from AT TIME ZONE 'Asia/Dhaka')::date - 1)
     AND (v_to IS NULL OR e.spent_on <= (v_to AT TIME ZONE 'Asia/Dhaka')::date + 1);

 RETURN jsonb_build_object('orders',v_orders,'products',v_products,'resellers',v_resellers,'agents',v_agents,'expenses',v_expenses);
END $function$;

REVOKE ALL ON FUNCTION public.admin_business_report(bigint,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_business_report(bigint,bigint) TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);