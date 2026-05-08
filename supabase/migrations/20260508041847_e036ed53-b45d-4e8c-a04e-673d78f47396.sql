UPDATE public.settings 
SET 
  bot_enabled = true,
  bot_process_audio = true,
  bot_process_receipts = true,
  bot_auto_confirm_payment = true,
  bot_negotiation_enabled = true
WHERE whatsapp_api_url = 'https://nexsiles-evolution-api.y7p1l4.easypanel.host/';