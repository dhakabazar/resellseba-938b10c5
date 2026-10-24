ALTER TABLE public.order_notes ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'process';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_notes_type_chk'
  ) THEN
    ALTER TABLE public.order_notes ADD CONSTRAINT order_notes_type_chk CHECK (note_type IN ('process', 'invoice'));
  END IF;
END $$;
