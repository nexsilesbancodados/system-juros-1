
ALTER TABLE public.contract_installments
  ADD COLUMN IF NOT EXISTS collection_status text,
  ADD COLUMN IF NOT EXISTS last_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_collected_channel text,
  ADD COLUMN IF NOT EXISTS collection_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.mark_installment_collected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.installment_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Only outbound collection channels mark "cobrado"
  IF NEW.channel IN ('whatsapp','email','sms','pix_copy','manual') THEN
    UPDATE public.contract_installments
    SET
      collection_status = 'cobrado',
      last_collected_at = COALESCE(NEW.created_at, now()),
      last_collected_channel = NEW.channel,
      collection_count = COALESCE(collection_count, 0) + 1
    WHERE id = NEW.installment_id
      AND status <> 'paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_installment_collected ON public.collection_attempts;
CREATE TRIGGER trg_mark_installment_collected
AFTER INSERT ON public.collection_attempts
FOR EACH ROW
EXECUTE FUNCTION public.mark_installment_collected();
