// Public edge function called by /cobrador-externo (anon user) to upload
// a payment receipt. We validate the collector token before letting the
// file land in the owner's storage folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const form = await req.formData();
    const token = String(form.get("collector_token") || "").trim();
    const installmentId = String(form.get("installment_id") || "").trim();
    const file = form.get("file") as File | null;

    if (!token || !installmentId || !file) {
      return json({ error: "Missing collector_token, installment_id or file" }, 400);
    }
    if (file.size > 8 * 1024 * 1024) {
      return json({ error: "File too large (max 8MB)" }, 413);
    }
    const okTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!okTypes.includes(file.type)) {
      return json({ error: "Unsupported file type" }, 415);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Validate collector token → resolve owner user_id
    const { data: tok } = await admin
      .from("collector_tokens")
      .select("user_id, collector_id, revoked_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!tok || tok.revoked_at || (tok.expires_at && new Date(tok.expires_at) < new Date())) {
      return json({ error: "Invalid or expired collector token" }, 401);
    }

    // 2) Ensure the installment belongs to that owner
    const { data: inst } = await admin
      .from("contract_installments")
      .select("id, user_id")
      .eq("id", installmentId)
      .maybeSingle();
    if (!inst || inst.user_id !== tok.user_id) {
      return json({ error: "Installment not found for this collector" }, 403);
    }

    // 3) Upload using service role to the owner's namespaced folder
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
    const path = `${tok.user_id}/comprovantes/${installmentId}-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await admin.storage.from("uploads").upload(path, bytes, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: signed } = await admin.storage
      .from("uploads")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

    return json({ ok: true, path, signed_url: signed?.signedUrl ?? null });
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
