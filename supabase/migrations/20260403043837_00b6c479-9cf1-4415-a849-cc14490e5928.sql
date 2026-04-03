ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#d97706',
ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#f59e0b',
ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'dark';