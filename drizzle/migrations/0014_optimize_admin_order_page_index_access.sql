CREATE OR REPLACE FUNCTION public.admin_orders_page(_statuses text[] DEFAULT NULL, _from_ts bigint DEFAULT NULL, _to_ts bigint DEFAULT NULL, _limit integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
 v_orders jsonb; v_ids uuid[]; v_items jsonb; v_ship jsonb; v_counts jsonb; v_resellers jsonb;
 v_from timestamptz := CASE WHEN _from_ts IS NULL THEN NULL ELSE to_timestamp(_from_ts / 1000.0) END;
 v_to timestamptz := CASE WHEN _to_ts IS NULL THEN NULL ELSE to_timestamp(_to_ts / 1000.0) END;
 v_statuses public.order_status[] := CASE WHEN cardinality(_statuses) > 0 THEN _statuses::public.order_status[] ELSE NULL END;
BEGIN
 IF NOT public.has_any_permission(auth.uid(), '{orders.view,orders.edit,orders.create,orders.delete,orders.status,orders.ship}'::text[]) THEN RAISE EXCEPTION 'not authorized'; END IF;
 WITH selected_orders AS MATERIALIZED (
   SELECT o.* FROM public.orders o
   WHERE (v_statuses IS NULL OR o.status = ANY(v_statuses))
     AND (v_from IS NULL OR o.created_at >= v_from)
     AND (v_to IS NULL OR o.created_at <= v_to)
   ORDER BY o.created_at DESC LIMIT _limit
 )
 SELECT coalesce(jsonb_agg(row ORDER BY ca DESC), '[]'::jsonb), coalesce(array_agg(id), '{}'::uuid[]) INTO v_orders,v_ids
 FROM (
 SELECT o.id, o.created_at AS ca, jsonb_build_object(
 'id',o.id,'reseller_id',o.reseller_id,'order_number',o.order_number,
 'customer_name',o.customer_name,'customer_phone',o.customer_phone,'address_line',o.address_line,'area',o.area,'city',o.city,
 'subtotal',o.subtotal,'discount',o.discount,'shipping_cost',o.shipping_cost,'sa_cost_total',o.sa_cost_total,'packaging_total',o.packaging_total,
 'delivery_cost',o.delivery_cost,'received_amount',o.received_amount,'advance_amount',o.advance_amount,'advance_by',o.advance_by,
 'payment_provider',o.payment_provider,'transaction_id',o.transaction_id,'payment_sender',o.payment_sender,'payment_config_id',o.payment_config_id,'paid_amount',o.paid_amount,'total',o.total,
 'status',o.status,'payment_status',o.payment_status,'payment_method',o.payment_method,'forwarded_to_admin',o.forwarded_to_admin,
 'created_at',o.created_at,'updated_at',o.updated_at,'reseller_note',o.reseller_note,'admin_note',o.admin_note,
 'resellers',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('business_name',r.business_name,'code',r.code,'contact_phone',r.contact_phone,
 'agents',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('display_name',a.display_name) END) END
 ) AS row FROM selected_orders o LEFT JOIN public.resellers r ON r.id=o.reseller_id LEFT JOIN public.agents a ON a.id=r.agent_id
 ) s;
 SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) INTO v_items FROM (SELECT order_id,product_id,product_name,product_image,quantity,returned_qty,reseller_price,line_total,sa_price,buying_price,packaging_cost FROM public.order_items WHERE order_id=ANY(v_ids)) i;
 SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) INTO v_ship FROM (SELECT id,order_id,provider,tracking_id,consignment_id FROM public.shipments WHERE order_id=ANY(v_ids)) s;
 IF _limit IS NULL THEN
 SELECT coalesce(jsonb_object_agg(status,c),'{}'::jsonb) INTO v_counts FROM (SELECT status::text AS status,count(*) AS c FROM public.orders WHERE (v_from IS NULL OR created_at>=v_from) AND (v_to IS NULL OR created_at<=v_to) GROUP BY 1) t;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'business_name',business_name,'code',code,'contact_phone',contact_phone) ORDER BY business_name),'[]'::jsonb) INTO v_resellers FROM public.resellers;
 RETURN jsonb_build_object('orders',v_orders,'items',v_items,'shipments',v_ship,'status_counts',coalesce(v_counts,'{}'::jsonb),'resellers',v_resellers,'partial',_limit IS NOT NULL);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.admin_orders_page(text[],bigint,bigint,integer) TO authenticated;
COMMENT ON FUNCTION public.admin_orders_page(text[],bigint,bigint,integer) IS 'Typed status predicate uses existing status/created indexes; materialized limited rows precede reseller joins and JSON construction. Parameter-specific planning avoids generic optional-filter scans.';