ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS portal_title TEXT DEFAULT 'Portal do Cliente',
ADD COLUMN IF NOT EXISTS portal_subtitle TEXT DEFAULT 'Acompanhe seus contratos e pagamentos',
ADD COLUMN IF NOT EXISTS portal_welcome_message TEXT,
ADD COLUMN IF NOT EXISTS portal_primary_color TEXT,
ADD COLUMN IF NOT EXISTS portal_logo_url TEXT,
ADD COLUMN IF NOT EXISTS portal_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS portal_contact_email TEXT;