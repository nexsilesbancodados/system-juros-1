
UPDATE public.profiles
SET subscription_expires_at = '2099-12-31'::timestamptz,
    trial_ends_at = '2099-12-31'::timestamptz,
    is_blocked = false;

CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.trial_ends_at = '2099-12-31'::timestamptz;
  NEW.subscription_expires_at = '2099-12-31'::timestamptz;
  RETURN NEW;
END;
$function$;
