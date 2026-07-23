// Helpers de autenticação/autorização compartilhados entre edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Comparação de strings em tempo constante (evita timing side-channel em segredos). */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

/**
 * Autentica o chamador pelo JWT do Supabase (header Authorization).
 * Retorna o usuário autenticado ou null. NÃO aceita a anon key sozinha como usuário
 * (getUser só resolve um usuário real logado).
 */
export async function getCallerUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await client.auth.getUser();
  return data?.user ?? null;
}

/**
 * Gate por segredo compartilhado (cron/webhook interno). FAIL-SAFE:
 * se o env `envName` NÃO estiver configurado, retorna true (não bloqueia) e apenas
 * loga um aviso — assim o deploy do código não derruba jobs/recepção antes de você
 * configurar o segredo. Quando o env é configurado, passa a EXIGIR o segredo.
 * O segredo pode vir no header (default `x-cron-secret`) ou no query `?secret=`.
 */
export function checkSharedSecret(req: Request, envName: string, headerName = "x-cron-secret"): boolean {
  const expected = Deno.env.get(envName);
  if (!expected) {
    console.warn(`[guard] ${envName} não configurado — endpoint operando sem proteção de segredo`);
    return true;
  }
  const url = new URL(req.url);
  const provided = req.headers.get(headerName) ?? url.searchParams.get("secret") ?? "";
  return timingSafeEqual(provided, expected);
}

export const unauthorized = (corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
