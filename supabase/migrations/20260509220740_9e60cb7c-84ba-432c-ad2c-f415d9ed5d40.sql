-- Allow public read access to certain columns in settings
CREATE POLICY "Public can view checkout URL" 
ON public.settings 
FOR SELECT 
USING (true);

-- Ensure authenticated users can also read it (redundant but safe)
-- The existing policy "Users manage own settings" already covers their own.

-- Update handle_new_user to ensure every user gets a settings row
CREATE OR REPLACE FUNCTION public.handle_new_user_with_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'Usuário'),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    INSERT INTO public.settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$;

-- Note: We already have on_auth_user_created trigger, let's update it or add another.
-- Since handle_new_user already exists, we might want to replace it.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_with_settings();
