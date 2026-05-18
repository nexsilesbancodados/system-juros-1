// Validação de CPF e CNPJ com dígitos verificadores

export const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

export const formatCpfCnpj = (raw: string) => {
  const d = onlyDigits(raw);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

export const isValidCPF = (raw: string): boolean => {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(cpf[i], 10) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(cpf[9], 10) && calc(10) === parseInt(cpf[10], 10);
};

export const isValidCNPJ = (raw: string): boolean => {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (slice: number) => {
    const weights = slice === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(cnpj[i], 10) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(cnpj[12], 10) && calc(13) === parseInt(cnpj[13], 10);
};

export const validateCpfCnpj = (raw: string): { ok: boolean; type?: "cpf" | "cnpj"; error?: string } => {
  const d = onlyDigits(raw);
  if (!d) return { ok: false, error: "Informe um CPF ou CNPJ." };
  if (d.length === 11) {
    return isValidCPF(d)
      ? { ok: true, type: "cpf" }
      : { ok: false, type: "cpf", error: "CPF inválido (dígitos verificadores não conferem)." };
  }
  if (d.length === 14) {
    return isValidCNPJ(d)
      ? { ok: true, type: "cnpj" }
      : { ok: false, type: "cnpj", error: "CNPJ inválido (dígitos verificadores não conferem)." };
  }
  return { ok: false, error: "CPF deve ter 11 dígitos e CNPJ 14 dígitos." };
};
