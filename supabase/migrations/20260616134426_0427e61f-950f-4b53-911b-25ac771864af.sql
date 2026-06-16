
-- Disable the infinite-trial behavior for NEW signups.
-- Existing rows are untouched on purpose: we don't want to lock out current users.
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- No automatic trial. Access requires an active subscription
  -- (granted by the Hubla webhook after payment confirmation).
  NEW.trial_ends_at := NULL;
  NEW.subscription_expires_at := NULL;
  RETURN NEW;
END;
$function$;
