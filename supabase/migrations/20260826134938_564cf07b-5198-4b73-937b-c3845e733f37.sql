CREATE POLICY "Payments: authenticated read active platform"
ON public.payment_configs
FOR SELECT
TO authenticated
USING (is_active AND reseller_id IS NULL);