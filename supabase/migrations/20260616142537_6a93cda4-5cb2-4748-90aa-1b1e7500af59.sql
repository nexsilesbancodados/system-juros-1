UPDATE public.profiles
SET trial_ends_at = NULL,
    subscription_expires_at = NULL
WHERE (trial_ends_at IS NOT NULL AND trial_ends_at > now() + interval '2 years')
   OR (subscription_expires_at IS NOT NULL AND subscription_expires_at > now() + interval '2 years');