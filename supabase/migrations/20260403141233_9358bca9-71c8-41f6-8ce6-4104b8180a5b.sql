ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS sidebar_style text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS login_title text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS login_subtitle text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS footer_text text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS border_radius text DEFAULT '16',
ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'default';