ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS notes_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_reseller_note_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    IF COALESCE(NEW.notes, '') = '' THEN
      NEW.notes_by := NULL;
      NEW.notes_at := NULL;
    ELSE
      NEW.notes_by := auth.uid();
      NEW.notes_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_reseller_note_author ON public.resellers;
CREATE TRIGGER trg_stamp_reseller_note_author
BEFORE UPDATE ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.stamp_reseller_note_author();