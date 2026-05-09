-- Add trial column if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- Give 3 days of trial to all existing users (starting from now)
UPDATE public.profiles 
SET trial_ends_at = now() + interval '3 days'
WHERE trial_ends_at IS NULL;

-- Function to handle new user trials
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  NEW.trial_ends_at = now() + interval '3 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON public.profiles;
CREATE TRIGGER on_auth_user_created_trial
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_trial();