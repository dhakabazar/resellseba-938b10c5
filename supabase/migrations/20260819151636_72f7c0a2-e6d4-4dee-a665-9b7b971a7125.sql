ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS advanced_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.verification_codes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  target text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);

GRANT ALL ON public.verification_codes TO service_role;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
-- no policies on purpose: only SECURITY DEFINER functions below may touch it

CREATE OR REPLACE FUNCTION public.verify_issue(_channel text, _target text, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _channel NOT IN ('email','sms') THEN RAISE EXCEPTION 'Bad channel'; END IF;
  INSERT INTO public.verification_codes (user_id, channel, target, code_hash, attempts, expires_at, created_at)
  VALUES (uid, _channel, _target,
          encode(extensions.digest(_code || ':' || uid::text || ':rsb-verify-pepper', 'sha256'), 'hex'),
          0, now() + interval '15 minutes', now())
  ON CONFLICT (user_id, channel) DO UPDATE
    SET target = excluded.target, code_hash = excluded.code_hash,
        attempts = 0, expires_at = excluded.expires_at, created_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.verify_check(_channel text, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE uid uuid := auth.uid(); row public.verification_codes; ok boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO row FROM public.verification_codes WHERE user_id = uid AND channel = _channel;
  IF row IS NULL THEN RETURN false; END IF;
  IF row.expires_at < now() THEN RETURN false; END IF;
  IF row.attempts >= 8 THEN RETURN false; END IF;
  ok := row.code_hash = encode(extensions.digest(_code || ':' || uid::text || ':rsb-verify-pepper', 'sha256'), 'hex');
  IF ok THEN
    IF _channel = 'email' THEN
      UPDATE public.profiles SET email_verified_at = now() WHERE id = uid;
    ELSE
      UPDATE public.profiles SET phone_verified_at = now() WHERE id = uid;
    END IF;
    DELETE FROM public.verification_codes WHERE user_id = uid AND channel = _channel;
  ELSE
    UPDATE public.verification_codes SET attempts = attempts + 1 WHERE user_id = uid AND channel = _channel;
  END IF;
  RETURN ok;
END $$;

CREATE OR REPLACE FUNCTION public.verify_state()
RETURNS TABLE(email_verified_at timestamptz, phone_verified_at timestamptz, email_sent_at timestamptz, sms_sent_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.email_verified_at, p.phone_verified_at,
    (SELECT c.created_at FROM public.verification_codes c WHERE c.user_id = p.id AND c.channel = 'email'),
    (SELECT c.created_at FROM public.verification_codes c WHERE c.user_id = p.id AND c.channel = 'sms')
  FROM public.profiles p WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.verify_issue(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_check(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_state() FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_issue(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_check(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_state() TO authenticated;