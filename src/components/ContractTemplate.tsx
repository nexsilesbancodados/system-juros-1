import { renderContractTemplate } from "@/utils/contractTemplate";

interface Installment {
  installment_number: number;
  amount: number;
  due_date: string;
  status?: string;
}

interface ContractData {
  customTemplate?: string | null;
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
  companyLogoUrl?: string;
  installments?: Installment[];
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ContractTemplate = ({ data }: { data: ContractData }) => {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const startFormatted = new Date(data.startDate + "T12:00:00").toLocaleDateString("pt-BR");

  return (
    <div
      className="bg-card border border-border rounded-2xl p-8 sm:p-12 space-y-8 print:bg-white print:text-black print:border-none print:shadow-none print:p-10"
      id="contract-template"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}
    >
      {/* Header with optional logo */}
      <div className="flex items-center justify-between gap-6 border-b-2 border-primary/30 pb-6 print:border-gray-300">
        <div className="flex items-center gap-4">
          {data.companyLogoUrl && (
            <img
              src={data.companyLogoUrl}
              alt={data.companyName}
              className="w-16 h-16 rounded-xl object-cover ring-1 ring-border"
              crossOrigin="anonymous"
            />
          )}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground print:text-gray-500">
              {data.companyName || "Empresa"}
            </p>
            {data.companyCnpj && (
              <p className="text-[10px] text-muted-foreground print:text-gray-500 mt-0.5">
                CNPJ: {data.companyCnpj}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground print:text-gray-500">
            Documento
          </p>
          <p className="text-[11px] font-mono text-foreground print:text-black mt-0.5">
            #{Date.now().toString(36).toUpperCase().slice(-8)}
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight print:text-black">
          CONTRATO DE EMPRÉSTIMO PESSOAL
        </h1>
        <p className="text-xs text-muted-foreground print:text-gray-600">
          Instrumento Particular de Confissão de Dívida
        </p>
      </div>

      {/* Parties */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em] print:text-black border-l-4 border-primary pl-2">
          1. Das Partes
        </h2>
        <div className="bg-muted/20 rounded-xl p-4 space-y-3 text-sm print:bg-gray-50 print:border print:border-gray-200">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground print:text-gray-500">Credor</p>
            <p className="text-foreground print:text-black font-semibold mt-0.5">
              {data.companyName}
              {data.companyCnpj && <span className="font-normal text-muted-foreground print:text-gray-600"> · CNPJ {data.companyCnpj}</span>}
            </p>
          </div>
          <div className="border-t border-border/50 print:border-gray-200" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground print:text-gray-500">Devedor(a)</p>
            <p className="text-foreground print:text-black font-semibold mt-0.5">{data.clientName}</p>
            <div className="grid grid-cols-2 gap-1 mt-1 text-xs">
              {data.cpfCnpj && <p className="text-muted-foreground print:text-gray-600">CPF/CNPJ: {data.cpfCnpj}</p>}
              {data.phone && <p className="text-muted-foreground print:text-gray-600">Tel: {data.phone}</p>}
              {data.email && <p className="text-muted-foreground print:text-gray-600 col-span-2">E-mail: {data.email}</p>}
              {data.address && <p className="text-muted-foreground print:text-gray-600 col-span-2">End: {data.address}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Object */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em] print:text-black border-l-4 border-primary pl-2">
          2. Do Objeto
        </h2>
        <p className="text-sm text-foreground leading-relaxed print:text-black">
          O presente contrato tem por objeto o empréstimo pessoal no valor de{" "}
          <span className="font-bold">R$ {fmt(data.capital)}</span>, concedido pelo CREDOR ao DEVEDOR(A),
          nas condições estabelecidas neste instrumento.
        </p>
      </section>

      {/* Financial conditions */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em] print:text-black border-l-4 border-primary pl-2">
          3. Das Condições Financeiras
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: "Capital", value: `R$ ${fmt(data.capital)}` },
            { label: "Taxa", value: `${data.interestRate}% / ${data.frequency.toLowerCase()}` },
            { label: "Parcelas", value: `${data.numInstallments}x` },
            { label: "Valor Parcela", value: `R$ ${fmt(data.installmentAmount)}` },
            { label: "Total Juros", value: `R$ ${fmt(data.totalInterest)}` },
            { label: "Total a Pagar", value: `R$ ${fmt(data.totalAmount)}` },
            { label: "Frequência", value: data.frequency },
            { label: "1º Vencimento", value: startFormatted },
          ].map(i => (
            <div key={i.label} className="bg-muted/20 rounded-lg p-2.5 print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider print:text-gray-500">{i.label}</p>
              <p className="font-semibold text-xs text-foreground mt-0.5 print:text-black">{i.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payment schedule */}
      {data.installments && data.installments.length > 0 && (
        <section className="space-y-3" style={{ pageBreakInside: "auto" }}>
          <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em] print:text-black border-l-4 border-primary pl-2">
            4. Cronograma de Pagamentos
          </h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/30 print:bg-gray-100">
                <th className="text-left px-3 py-2 border border-border print:border-gray-300 text-foreground print:text-black font-semibold">Parcela</th>
                <th className="text-left px-3 py-2 border border-border print:border-gray-300 text-foreground print:text-black font-semibold">Vencimento</th>
                <th className="text-right px-3 py-2 border border-border print:border-gray-300 text-foreground print:text-black font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.installments.map((inst) => (
                <tr key={inst.installment_number} className="print:break-inside-avoid">
                  <td className="px-3 py-1.5 border border-border print:border-gray-300 text-foreground print:text-black">
                    {String(inst.installment_number).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-1.5 border border-border print:border-gray-300 text-foreground print:text-black">
                    {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-1.5 border border-border print:border-gray-300 text-foreground print:text-black text-right font-mono">
                    R$ {fmt(Number(inst.amount))}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/20 print:bg-gray-50 font-bold">
                <td colSpan={2} className="px-3 py-2 border border-border print:border-gray-300 text-foreground print:text-black text-right">
                  TOTAL
                </td>
                <td className="px-3 py-2 border border-border print:border-gray-300 text-foreground print:text-black text-right font-mono">
                  R$ {fmt(data.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Penalties */}
      <section className="space-y-3" style={{ pageBreakInside: "avoid" }}>
        <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em] print:text-black border-l-4 border-primary pl-2">
          5. Das Penalidades por Atraso
        </h2>
        <div className="text-sm text-foreground leading-relaxed space-y-2 print:text-black">
          <p>Em caso de atraso no pagamento de qualquer parcela, incidirão sobre o valor em atraso:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Juros diários de <span className="font-bold">{data.dailyInterestPercent}%</span> sobre o valor da parcela vencida;</li>
            <li>Multa de <span className="font-bold">{data.lateFeePercent}%</span> sobre o valor da parcela vencida.</li>
          </ul>
        </div>
      </section>

      {/* General clauses */}
      <section className="space-y-3" style={{ pageBreakInside: "avoid" }}>
        <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em] print:text-black border-l-4 border-primary pl-2">
          6. Das Disposições Gerais
        </h2>
        <div className="text-sm text-foreground leading-relaxed space-y-2 print:text-black">
          <p><span className="font-semibold">6.1</span> O DEVEDOR(A) compromete-se a efetuar o pagamento das parcelas nas datas de vencimento estabelecidas.</p>
          <p><span className="font-semibold">6.2</span> O pagamento antecipado poderá ser realizado a qualquer momento, com desconto proporcional dos juros futuros, mediante acordo entre as partes.</p>
          <p><span className="font-semibold">6.3</span> O presente contrato é firmado em caráter irrevogável e irretratável, obrigando as partes e seus sucessores.</p>
          <p><span className="font-semibold">6.4</span> Para dirimir quaisquer dúvidas ou litígios oriundos deste contrato, fica eleito o foro da comarca do CREDOR.</p>
        </div>
      </section>

      {/* Signatures */}
      <section className="space-y-6 pt-6 border-t border-border print:border-gray-300" style={{ pageBreakInside: "avoid" }}>
        <p className="text-sm text-center text-muted-foreground print:text-gray-700">
          Por estarem justos e acordados, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma.
        </p>
        <p className="text-sm text-center text-foreground print:text-black font-medium">
          _________________, {today}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 pt-10">
          <div className="text-center space-y-2">
            <div className="border-t-2 border-foreground/40 pt-2 mx-6 print:border-black/60" />
            <p className="text-sm font-semibold text-foreground print:text-black">{data.companyName}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground print:text-gray-500">Credor</p>
            {data.companyCnpj && <p className="text-[10px] text-muted-foreground print:text-gray-500">CNPJ {data.companyCnpj}</p>}
          </div>
          <div className="text-center space-y-2">
            <div className="border-t-2 border-foreground/40 pt-2 mx-6 print:border-black/60" />
            <p className="text-sm font-semibold text-foreground print:text-black">{data.clientName}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground print:text-gray-500">Devedor(a)</p>
            {data.cpfCnpj && <p className="text-[10px] text-muted-foreground print:text-gray-500">CPF {data.cpfCnpj}</p>}
          </div>
        </div>

        <div className="text-center pt-4 border-t border-border/50 print:border-gray-200">
          <p className="text-[9px] text-muted-foreground print:text-gray-500 tracking-wider">
            Documento gerado eletronicamente em {today}
          </p>
        </div>
      </section>
    </div>
  );
};

export default ContractTemplate;
