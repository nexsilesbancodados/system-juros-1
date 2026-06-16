// Authenticated edge function to update sensitive secret columns
// on `public.settings` that the frontend can no longer touch directly.
// Allowed fields: whatsapp_api_key, hubla_webhook_token.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: clErr } = await userClient.auth.getClaims(token);
    if (clErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const allowed: Record<string, unknown> = {};
    for (const key of ["whatsapp_api_key", "hubla_webhook_token"] as const) {
      if (typeof body[key] === "string") {
        // Empty string = clear secret
        allowed[key] = body[key].trim().length === 0 ? null : body[key].trim();
      }
    }
    if (Object.keys(allowed).length === 0) {
      return json({ error: "No allowed fields provided" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ensure a row exists, then update only the secret columns.
    const { data: existing } = await admin
      .from("settings").select("id").eq("user_id", userId).maybeSingle();

    if (!existing) {
      const { error } = await admin.from("settings").insert({ user_id: userId, ...allowed });
      if (error) return json({ error: error.message }, 500);
    } else {
      const { error } = await admin.from("settings").update(allowed).eq("user_id", userId);
      if (error) return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
