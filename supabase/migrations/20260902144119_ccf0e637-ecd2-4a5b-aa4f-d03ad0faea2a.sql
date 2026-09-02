CREATE OR REPLACE FUNCTION public.courier_config_get(_provider text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg jsonb;
BEGIN
  IF NOT public.has_any_permission(
    auth.uid(),
    ARRAY['couriers.manage','orders.ship','orders.status','orders.edit']
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT config INTO _cfg
  FROM public.courier_configs
  WHERE provider = _provider::courier_provider
    AND is_active = true
  LIMIT 1;

  RETURN _cfg;
END;
$$;

CREATE OR REPLACE FUNCTION public.courier_config_patch(_provider text, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_permission(
    auth.uid(),
    ARRAY['couriers.manage','orders.ship','orders.status','orders.edit']
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.courier_configs
  SET config = config || COALESCE(_patch, '{}'::jsonb),
      updated_at = now()
  WHERE provider = _provider::courier_provider;
END;
$$;

REVOKE ALL ON FUNCTION public.courier_config_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.courier_config_patch(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.courier_config_get(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.courier_config_patch(text, jsonb) TO authenticated, service_role;