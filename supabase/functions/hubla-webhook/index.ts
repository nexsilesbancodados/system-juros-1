import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { sendEmail, templates } from "../_shared/brevo.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hubla-token',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Hubla Token from settings to verify
    const { data: settings } = await supabaseClient
      .from('settings')
      .select('hubla_webhook_token')
      .single()

    const hublaToken = req.headers.get('x-hubla-token')
    
    // Security check: Verify token if one is configured
    if (settings?.hubla_webhook_token && hublaToken !== settings.hubla_webhook_token) {
      console.error('Invalid Hubla token')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    console.log('Hubla Webhook Payload:', JSON.stringify(payload, null, 2))

    // Hubla event types: purchase_approved, purchase_canceled, subscription_canceled, etc.
    const event = payload.event
    const buyer = payload.data?.buyer || payload.data?.customer
    const email = buyer?.email
    const status = payload.data?.status

    if (!email) {
      return new Response(JSON.stringify({ error: 'No email found in payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subscriptionStatus = 'inactive'
    if (event === 'purchase_approved' || status === 'approved' || status === 'active') {
      subscriptionStatus = 'active'
    } else if (event === 'purchase_canceled' || event === 'subscription_canceled' || status === 'canceled') {
      subscriptionStatus = 'canceled'
    } else if (status === 'refunded') {
      subscriptionStatus = 'refunded'
    }

    // Update or Create Subscription
    const { data: userData } = await supabaseClient
      .from('profiles')
      .select('id, name')
      .eq('email', email)
      .maybeSingle()

    const { error: subError } = await supabaseClient
      .from('subscriptions')
      .upsert({
        email: email,
        user_id: userData?.id || null,
        status: subscriptionStatus,
        hubla_order_id: payload.data?.id?.toString(),
        plan_name: payload.data?.product?.name,
        amount_paid: payload.data?.amount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' })

    if (subError) throw subError

    // Send email notification on subscription activation
    if (subscriptionStatus === 'active') {
      // Generate a magic link so the customer can log in without a password
      let actionLink: string | null = null
      try {
        const siteUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || ''
        const { data: linkData, error: linkError } = await (supabaseClient as any).auth.admin.generateLink({
          type: userData ? 'magiclink' : 'invite',
          email,
          options: { redirectTo: `${siteUrl}/dashboard` },
        })
        if (linkError) {
          console.error('generateLink error:', linkError)
        } else {
          actionLink = linkData?.properties?.action_link || null
        }
      } catch (e) {
        console.error('magic link generation failed:', e)
      }

      const displayName = (userData as any)?.name || email.split('@')[0]
      const ctaUrl = actionLink || 'https://systemjuros.com.br'
      const subject = userData ? 'Assinatura ativa! Acesse sua conta 🎉' : 'Bem-vindo! Crie sua conta no System Juros 🎉'
      const intro = userData
        ? 'Seu pagamento foi aprovado e sua assinatura está <strong>Ativa</strong>! Clique no botão abaixo para acessar o sistema sem precisar de senha.'
        : 'Seu pagamento foi aprovado! Clique no botão abaixo para criar sua senha e acessar o System Juros.'

      await sendEmail({
        to: [{ email, name: displayName }],
        subject,
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #111;">Olá, ${displayName}!</h2>
            <p style="color: #444; line-height: 1.6;">${intro}</p>
            <div style="margin: 32px 0; text-align: center;">
              <a href="${ctaUrl}" style="background: #fbbf24; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                ${userData ? 'Acessar Dashboard' : 'Ativar minha conta'}
              </a>
            </div>
            <p style="font-size: 12px; color: #888;">Este link é único e expira em breve. Se precisar de ajuda, responda este e-mail.</p>
          </div>
        `,
      })
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing webhook:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
