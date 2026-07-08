// One-off helper to create a QA test user with an active subscription.
// Protected by SEED_TEST_USER_TOKEN header.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const expected = Deno.env.get("SEED_TEST_USER_TOKEN") ?? "";
    const provided = req.headers.get("x-seed-token") ?? "";
    if (!expected || provided.length !== expected.length || provided !== expected) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const email = "qa-test@systemjuros.local";
    const password = "QaTest!2026#SystemJuros";

    // Create or lookup user
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: "QA Tester" },
    });
    if (createErr) {
      // If already exists, look it up
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u) => u.email === email);
      if (!found) return json({ error: createErr.message }, 500);
      userId = found.id;
      // Reset password so we know it
      await admin.auth.admin.updateUserById(found.id, { password });
    } else {
      userId = created.user?.id ?? null;
    }
    if (!userId) return json({ error: "no user id" }, 500);

    // Ensure profile exists with future subscription
    const future = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    await admin.from("profiles").upsert(
      { id: userId, email, name: "QA Tester", subscription_expires_at: future, is_admin: true },
      { onConflict: "id" },
    );
    await admin.from("subscriptions").upsert(
      { user_id: userId, email, status: "active", plan_name: "QA", updated_at: new Date().toISOString() },
      { onConflict: "email" },
    );

    return json({ ok: true, email, password, user_id: userId });
  } catch (e: any) {
    return json({ error: e?.message ?? "error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
