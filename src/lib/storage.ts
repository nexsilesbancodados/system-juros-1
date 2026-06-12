import { supabase } from "@/integrations/supabase/client";

// Long expiry for URLs persisted in DB columns (avatars, receipts, logos,
// contract docs, WhatsApp media). ~10 years — effectively permanent while
// still requiring an authenticated, signed token.
const LONG_EXPIRES_IN = 60 * 60 * 24 * 365 * 10;

/**
 * Generate a signed URL for a file in the `uploads` bucket.
 * Use this instead of getPublicUrl now that the bucket is private.
 */
export async function getSignedUploadUrl(
  path: string,
  expiresIn: number = LONG_EXPIRES_IN,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("uploads")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    console.error("Falha ao gerar signed URL:", error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Upload a file and return a long-lived signed URL ready to persist.
 */
export async function uploadAndSign(
  path: string,
  file: File | Blob,
  options: { upsert?: boolean; contentType?: string } = {},
): Promise<{ url: string | null; path: string; error: Error | null }> {
  const { error: upErr } = await supabase.storage
    .from("uploads")
    .upload(path, file, {
      upsert: options.upsert ?? false,
      contentType: options.contentType,
    });
  if (upErr) return { url: null, path, error: upErr };
  const url = await getSignedUploadUrl(path);
  return { url, path, error: null };
}
