
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS favicon_url text;

DROP VIEW IF EXISTS public.settings_safe;

CREATE VIEW public.settings_safe
WITH (security_invoker=on) AS
SELECT
  s.id, s.user_id, s.created_at,
  s.company_name, s.company_cnpj, s.company_logo_url, s.favicon_url,
  s.primary_color, s.accent_color, s.theme_mode, s.sidebar_style,
  s.login_title, s.login_subtitle, s.footer_text,
  s.border_radius, s.font_family,
  s.default_interest_rate, s.default_late_fee, s.default_daily_interest, s.default_frequency,
  s.whatsapp_api_url, s.whatsapp_instance,
  (s.whatsapp_api_key IS NOT NULL AND length(s.whatsapp_api_key) > 0) AS whatsapp_api_key_configured,
  s.n8n_webhook_url, s.push_notifications_enabled,
  s.bot_enabled, s.bot_auto_send, s.bot_send_hour, s.bot_send_minute,
  s.bot_max_messages_per_day, s.bot_work_days, s.bot_escalation_rules,
  s.bot_retry_interval_hours, s.bot_stop_on_payment, s.bot_notify_owner,
  s.bot_greeting_message, s.bot_closing_message,
  s.bot_send_pix, s.bot_send_receipt, s.bot_tone, s.bot_use_ai,
  s.bot_negotiation_enabled, s.bot_send_audio, s.bot_process_audio,
  s.bot_process_receipts, s.bot_auto_confirm_payment,
  s.bot_business_hours_only, s.bot_business_start, s.bot_business_end,
  s.portal_title, s.portal_subtitle, s.portal_welcome_message,
  s.portal_primary_color, s.portal_logo_url,
  s.portal_contact_phone, s.portal_contact_email,
  s.custom_contract_template,
  s.hubla_checkout_url,
  (s.hubla_webhook_token IS NOT NULL AND length(s.hubla_webhook_token) > 0) AS hubla_webhook_token_configured
FROM public.settings s;

GRANT SELECT ON public.settings_safe TO authenticated;

REVOKE UPDATE (is_admin, is_blocked, is_chat_blocked, trial_ends_at, subscription_expires_at, subscription_type)
  ON public.profiles FROM authenticated;
