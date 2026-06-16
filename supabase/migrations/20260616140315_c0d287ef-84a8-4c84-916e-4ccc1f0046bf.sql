
-- 1) Bloquear privilege escalation em profiles
CREATE OR REPLACE FUNCTION public.protect_profile_admin_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o caller NÃO é admin, força manter colunas sensíveis intactas
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := COALESCE(OLD.is_blocked, false);
    NEW.is_chat_blocked := COALESCE(OLD.is_chat_blocked, false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_admin_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_admin_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_admin_columns();

-- 2) Remover default hardcoded da whatsapp_api_key
ALTER TABLE public.settings ALTER COLUMN whatsapp_api_key DROP DEFAULT;

-- Limpar valor padrão compartilhado de tenants que ainda têm ele
UPDATE public.settings
SET whatsapp_api_key = NULL
WHERE whatsapp_api_key = '429683C4C977415CAAFCCE10F7D57E11';

-- 3) Remover UPDATE anônimo em comprovantes (só INSERT permitido)
DROP POLICY IF EXISTS uploads_anon_update_comprovantes ON storage.objects;
