To integrate Hubla checkout and automate the user flow (from purchase to access), we will follow these steps:

1. **Setup Hubla Checkout**:
   - Provide a way for the platform owner to add their Hubla product checkout URL in the settings.
   - Redirect new users to this checkout when they try to register or when their subscription is inactive.

2. **Automate Access via Webhooks**:
   - Create a new Supabase Edge Function `hubla-webhook` to receive notifications from Hubla (purchase approved, subscription canceled, etc.).
   - When a purchase is approved, the webhook will:
     - Check if the user already exists (by email).
     - If not, create a placeholder record or a system note to grant access once they register.
     - Update a new `subscriptions` table (or similar) to track active access.

3. **Database Schema Update**:
   - Create a `subscriptions` table to store status (active, trialing, past_due, canceled), end date, and Hubla reference IDs.
   - Add a column to `settings` to store the Hubla webhook token for security.

4. **UI Improvements**:
   - Create a beautiful, animated checkout redirection page or overlay.
   - Update the login/register logic to check for active subscription status before allowing full access.

### Technical Details
- **Webhook Endpoint**: `https://[PROJECT_ID].supabase.co/functions/v1/hubla-webhook`
- **Security**: Use the `x-hubla-token` header to verify that requests are coming from Hubla.
- **Workflow**: 
  1. User clicks "Assinar" or "Registrar".
  2. Redirect to Hubla Checkout.
  3. Hubla sends POST to our webhook after payment.
  4. Webhook updates `profiles` or `subscriptions` table.
  5. User logs in and finds the account active.

I will start by creating the database table and the webhook function.
