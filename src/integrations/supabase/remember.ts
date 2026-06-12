// Persistência opcional de "Lembrar-me" para o login.
// Mantido em arquivo separado porque src/integrations/supabase/client.ts
// é regenerado automaticamente.

const REMEMBER_KEY = "sj_remember_me";

export const setRememberMe = (remember: boolean) => {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
  } catch {
    /* noop */
  }
};

export const getRememberMe = (): boolean => {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  } catch {
    return true;
  }
};
