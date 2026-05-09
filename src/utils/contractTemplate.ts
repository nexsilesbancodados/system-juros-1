// Substitui placeholders {{chave}} no template do contrato com dados reais.
// Suporta tabela de parcelas via bloco {{#parcelas}}...{{/parcelas}} (cada linha repete por parcela).

export interface ContractPlaceholderData {
  clientName: string;
  cpfCnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  capital: number;
  interestRate: number;
  totalAmount: number;
  totalInterest: number;
  installmentAmount: number;
  numInstallments: number;
  frequency: string;
  startDate: string;
  lateFeePercent: number;
  dailyInterestPercent: number;
  companyName: string;
  companyCnpj: string;
  installments?: { installment_number: number; amount: number; due_date: string }[];
}

const fmtMoney = (v: number) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => {
  if (!d) return "";
  try {
    return new Date(d.length <= 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

export const CONTRACT_PLACEHOLDERS = [
  { key: "cliente_nome", desc: "Nome do cliente" },
  { key: "cliente_cpf", desc: "CPF/CNPJ do cliente" },
  { key: "cliente_telefone", desc: "Telefone" },
  { key: "cliente_whatsapp", desc: "WhatsApp" },
  { key: "cliente_email", desc: "E-mail" },
  { key: "cliente_endereco", desc: "Endereço" },
  { key: "empresa_nome", desc: "Nome da empresa (credor)" },
  { key: "empresa_cnpj", desc: "CNPJ da empresa" },
  { key: "capital", desc: "Valor emprestado" },
  { key: "total", desc: "Total a pagar" },
  { key: "total_juros", desc: "Total de juros" },
  { key: "valor_parcela", desc: "Valor de cada parcela" },
  { key: "num_parcelas", desc: "Quantidade de parcelas" },
  { key: "taxa", desc: "Taxa de juros (%)" },
  { key: "frequencia", desc: "Frequência (Mensal, Quinzenal, etc)" },
  { key: "data_inicio", desc: "Data do 1º vencimento" },
  { key: "multa", desc: "Multa por atraso (%)" },
  { key: "juros_diario", desc: "Juros diário (%)" },
  { key: "data_hoje", desc: "Data de hoje" },
  { key: "tabela_parcelas", desc: "Tabela completa de parcelas" },
];

export function renderContractTemplate(template: string, data: ContractPlaceholderData): string {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const map: Record<string, string> = {
    cliente_nome: data.clientName || "",
    cliente_cpf: data.cpfCnpj || "",
    cliente_telefone: data.phone || "",
    cliente_whatsapp: data.whatsapp || "",
    cliente_email: data.email || "",
    cliente_endereco: data.address || "",
    empresa_nome: data.companyName || "",
    empresa_cnpj: data.companyCnpj || "",
    capital: fmtMoney(data.capital),
    total: fmtMoney(data.totalAmount),
    total_juros: fmtMoney(data.totalInterest),
    valor_parcela: fmtMoney(data.installmentAmount),
    num_parcelas: String(data.numInstallments),
    taxa: `${data.interestRate}%`,
    frequencia: data.frequency,
    data_inicio: fmtDate(data.startDate),
    multa: `${data.lateFeePercent}%`,
    juros_diario: `${data.dailyInterestPercent}%`,
    data_hoje: today,
  };

  // Tabela de parcelas (texto simples)
  const tabela = (data.installments || [])
    .map(
      (p) =>
        `Parcela ${String(p.installment_number).padStart(2, "0")} — Vencimento ${fmtDate(
          p.due_date,
        )} — ${fmtMoney(Number(p.amount))}`,
    )
    .join("\n");
  map.tabela_parcelas = tabela;

  // Bloco repetível {{#parcelas}}...{{/parcelas}}
  let result = template.replace(/\{\{#parcelas\}\}([\s\S]*?)\{\{\/parcelas\}\}/g, (_m, block) => {
    return (data.installments || [])
      .map((p) =>
        block
          .replace(/\{\{numero\}\}/g, String(p.installment_number).padStart(2, "0"))
          .replace(/\{\{vencimento\}\}/g, fmtDate(p.due_date))
          .replace(/\{\{valor\}\}/g, fmtMoney(Number(p.amount))),
      )
      .join("");
  });

  // Substituições simples
  result = result.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) =>
    map[key.toLowerCase()] !== undefined ? map[key.toLowerCase()] : `{{${key}}}`,
  );

  return result;
}

export const DEFAULT_CONTRACT_TEMPLATE = `CONTRATO DE EMPRÉSTIMO PESSOAL

CREDOR: {{empresa_nome}} — CNPJ {{empresa_cnpj}}
DEVEDOR(A): {{cliente_nome}} — CPF/CNPJ {{cliente_cpf}}
Endereço: {{cliente_endereco}}
Telefone: {{cliente_telefone}} — E-mail: {{cliente_email}}

1. OBJETO
Empréstimo pessoal no valor de {{capital}}, concedido pelo CREDOR ao(à) DEVEDOR(A) nas condições deste instrumento.

2. CONDIÇÕES FINANCEIRAS
- Capital: {{capital}}
- Taxa: {{taxa}} ({{frequencia}})
- Parcelas: {{num_parcelas}}x de {{valor_parcela}}
- Total de juros: {{total_juros}}
- Total a pagar: {{total}}
- 1º vencimento: {{data_inicio}}

3. CRONOGRAMA
{{tabela_parcelas}}

4. PENALIDADES POR ATRASO
- Multa: {{multa}} sobre o valor da parcela vencida.
- Juros diários: {{juros_diario}} ao dia.

5. DISPOSIÇÕES GERAIS
5.1 O DEVEDOR(A) compromete-se a efetuar o pagamento nas datas estabelecidas.
5.2 O pagamento antecipado é permitido com desconto proporcional dos juros futuros.
5.3 Fica eleito o foro da comarca do CREDOR para dirimir litígios.

_______________, {{data_hoje}}


_____________________________            _____________________________
{{empresa_nome}} (Credor)                 {{cliente_nome}} (Devedor/a)
`;
