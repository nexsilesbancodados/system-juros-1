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
      .select('id')
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
    if (subscriptionStatus === 'active' && userData) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', userData.id)
        .single()
      
      const emailTemplate = templates.subscriptionActive(profile?.full_name || email)
      await sendEmail({
        to: [{ email: email, name: profile?.full_name }],
        subject: emailTemplate.subject,
        htmlContent: emailTemplate.html,
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
