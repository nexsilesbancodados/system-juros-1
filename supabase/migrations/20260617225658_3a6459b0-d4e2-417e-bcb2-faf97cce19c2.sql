CREATE OR REPLACE VIEW public.settings_safe AS
SELECT id, user_id, created_at, company_name, company_cnpj, company_logo_url, favicon_url,
  primary_color, accent_color, theme_mode, sidebar_style, login_title, login_subtitle,
  footer_text, border_radius, font_family, default_interest_rate, default_late_fee,
  default_daily_interest, default_frequency, whatsapp_api_url, whatsapp_instance,
  (whatsapp_api_key IS NOT NULL AND length(whatsapp_api_key) > 0) AS whatsapp_api_key_configured,
  n8n_webhook_url, push_notifications_enabled, bot_enabled, bot_auto_send, bot_send_hour,
  bot_send_minute, bot_max_messages_per_day, bot_work_days, bot_escalation_rules,
  bot_retry_interval_hours, bot_stop_on_payment, bot_notify_owner, bot_greeting_message,
  bot_closing_message, bot_send_pix, bot_send_receipt, bot_tone, bot_use_ai,
  bot_negotiation_enabled, bot_send_audio, bot_process_audio, bot_process_receipts,
  bot_auto_confirm_payment, bot_business_hours_only, bot_business_start, bot_business_end,
  portal_title, portal_subtitle, portal_welcome_message, portal_primary_color, portal_logo_url,
  portal_contact_phone, portal_contact_email, custom_contract_template, hubla_checkout_url,
  (hubla_webhook_token IS NOT NULL AND length(hubla_webhook_token) > 0) AS hubla_webhook_token_configured,
  modules_enabled
FROM public.settings s;

GRANT SELECT ON public.settings_safe TO authenticated;