import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { sendEmail } from "../_shared/brevo.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hubla-token, x-hubla-sandbox, x-hubla-idempotency',
}

// Maps Hubla v2 event types -> our internal subscription status
function statusFromV2Type(type: string, invoiceStatus?: string): string | null {
  if (!type) return null
  // Invoice events
  if (type === 'invoice.payment_succeeded' || type === 'invoice.paid_out') return 'active'
  if (type === 'invoice.refunded') return 'refunded'
  if (type === 'invoice.payment_failed' || type === 'invoice.expired') return 'inactive'
  if (type === 'invoice.status_updated') {
    if (invoiceStatus === 'paid') return 'active'
    if (invoiceStatus === 'refunded') return 'refunded'
    if (invoiceStatus === 'chargeback' || invoiceStatus === 'disputed') return 'canceled'
    if (invoiceStatus === 'expired' || invoiceStatus === 'unpaid') return 'inactive'
  }
  // Subscription events
  if (type === 'subscription.activated') return 'active'
  if (type === 'subscription.created') return 'inactive' // criada mas não paga
  if (type === 'subscription.expired' || type === 'subscription.deactivated') return 'canceled'
  return null
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

    // Get Hubla Token from settings to verify (any tenant with token configured)
    const { data: settings } = await supabaseClient
      .from('settings')
      .select('hubla_webhook_token')
      .not('hubla_webhook_token', 'is', null)
      .limit(1)
      .maybeSingle()

    const hublaToken = req.headers.get('x-hubla-token')
    const isSandbox = req.headers.get('x-hubla-sandbox') === 'true'
    const idempotencyKey = req.headers.get('x-hubla-idempotency')

    // Security: require token match if one is configured
    if (settings?.hubla_webhook_token && hublaToken !== settings.hubla_webhook_token) {
      console.error('Invalid Hubla token')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    console.log('Hubla Webhook (sandbox=' + isSandbox + ', idem=' + idempotencyKey + '):', JSON.stringify(payload))

    // Detect version: v2 has top-level `type` and `event`
    const isV2 = typeof payload?.type === 'string' && payload?.event && (payload?.version === '2.0.0' || payload?.event?.invoice || payload?.event?.subscription)

    let email: string | undefined
    let subscriptionStatus = 'inactive'
    let orderId: string | undefined
    let planName: string | undefined
    let amountPaid: number | undefined

    if (isV2) {
      const ev = payload.event
      const invoice = ev?.invoice
      const subscription = ev?.subscription
      const user = ev?.user || invoice?.payer || subscription?.payer

      email = user?.email || invoice?.payer?.email || subscription?.payer?.email
      orderId = invoice?.id || subscription?.id
      planName = ev?.product?.name
      // Hubla v2 amount is in cents
      if (invoice?.amount?.totalCents != null) {
        amountPaid = Number(invoice.amount.totalCents) / 100
      }
      const mapped = statusFromV2Type(payload.type, invoice?.status)
      if (mapped) subscriptionStatus = mapped
    } else {
      // v1 fallback
      const event = payload.event
      const buyer = payload.data?.buyer || payload.data?.customer
      email = buyer?.email
      const status = payload.data?.status
      orderId = payload.data?.id?.toString()
      planName = payload.data?.product?.name
      amountPaid = payload.data?.amount

      if (event === 'purchase_approved' || status === 'approved' || status === 'active') subscriptionStatus = 'active'
      else if (event === 'purchase_canceled' || event === 'subscription_canceled' || status === 'canceled') subscriptionStatus = 'canceled'
      else if (status === 'refunded') subscriptionStatus = 'refunded'
    }

    if (!email) {
      console.warn('No email in payload, ignoring')
      return new Response(JSON.stringify({ message: 'No email found, ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Ignore sandbox events from persisting real subscription state (just ack)
    if (isSandbox) {
      console.log('Sandbox event acknowledged (no DB write):', payload.type || payload.event)
      return new Response(JSON.stringify({ message: 'Sandbox event acknowledged' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find existing profile
    const { data: userData } = await supabaseClient
      .from('profiles')
      .select('id, name')
      .eq('email', email)
      .maybeSingle()

    const { error: subError } = await supabaseClient
      .from('subscriptions')
      .upsert({
        email,
        user_id: userData?.id || null,
        status: subscriptionStatus,
        hubla_order_id: orderId,
        plan_name: planName,
        amount_paid: amountPaid,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' })

    if (subError) throw subError

    // Send activation email on active status
    if (subscriptionStatus === 'active') {
      let actionLink: string | null = null
      try {
        const siteUrl = Deno.env.get('SITE_URL') || 'https://systemjuros.com.br'
        const { data: linkData, error: linkError } = await (supabaseClient as any).auth.admin.generateLink({
          type: userData ? 'magiclink' : 'invite',
          email,
          options: { redirectTo: `${siteUrl}/dashboard` },
        })
        if (linkError) console.error('generateLink error:', linkError)
        else actionLink = linkData?.properties?.action_link || null
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

    return new Response(JSON.stringify({ message: 'Webhook processed successfully', status: subscriptionStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error processing webhook:', error?.message || error)
    return new Response(JSON.stringify({ error: error?.message || 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
