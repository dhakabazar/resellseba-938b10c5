CREATE OR REPLACE FUNCTION public.capi_store_configs(p_code text, p_origin text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; c text := lower(trim(coalesce(p_code,''))); h text;
BEGIN
  IF c ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN rid := c::uuid; END IF;
  IF rid IS NULL AND c <> '' THEN SELECT id INTO rid FROM resellers WHERE lower(code) = c LIMIT 1; END IF;
  FOREACH h IN ARRAY ARRAY[c, lower(coalesce(p_origin,''))] LOOP
    EXIT WHEN rid IS NOT NULL;
    h := regexp_replace(regexp_replace(regexp_replace(h,'^https?://',''),'[/:].*$',''),'^www\.','');
    IF h <> '' AND h NOT IN ('localhost','127.0.0.1') THEN
      SELECT reseller_id INTO rid FROM reseller_domains
       WHERE regexp_replace(lower(hostname),'^www\.','') = h LIMIT 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reseller_id', rid, 'configs', coalesce((
    SELECT jsonb_agg(jsonb_build_object('platform',platform,'pixel_id',pixel_id,'access_token',access_token,
      'test_event_code',test_event_code,'is_active',is_active,'reseller_id',reseller_id))
    FROM marketing_configs WHERE is_active AND (reseller_id IS NULL OR reseller_id = rid)), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.capi_order(p_order_number text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id',o.id,'order_number',o.order_number,'total',o.total,'shipping_cost',o.shipping_cost,
    'customer_name',o.customer_name,'customer_phone',o.customer_phone,'address_line',o.address_line,'area',o.area,
    'payment_method',o.payment_method,'payment_status',o.payment_status,'created_at',o.created_at,'reseller_id',o.reseller_id,
    'order_items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'product_id',i.product_id,'product_name',i.product_name,
      'reseller_price',i.reseller_price,'quantity',i.quantity)) FROM order_items i WHERE i.order_id=o.id),'[]'::jsonb))
  FROM orders o
  WHERE o.order_number = regexp_replace(trim(p_order_number),'^#','')
     OR o.order_number = '#'||regexp_replace(trim(p_order_number),'^#','')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.capi_store_configs(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capi_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capi_store_configs(text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.capi_order(text) TO anon, authenticated, service_role;