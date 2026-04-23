/**
 * E-mail do super-administrador do sistema.
 * Apenas esta conta vê o painel admin e ações de admin total.
 */
export const SUPER_ADMIN_EMAIL = "lopesgustavo4377@gmail.com";

export const isSuperAdminEmail = (email?: string | null): boolean =>
  !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL;
