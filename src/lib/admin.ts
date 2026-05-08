/**
 * E-mail do super-administrador do sistema.
 * Apenas esta conta vê o painel admin e ações de admin total.
 */
export const SUPER_ADMIN_EMAILS = [
  "lopesgustavo4377@gmail.com",
  "inovalabinovalab@gmail.com"
];

export const isSuperAdminEmail = (email?: string | null): boolean =>
  !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
