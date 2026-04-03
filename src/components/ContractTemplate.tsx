interface ContractData {
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
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ContractTemplate = ({ data }: { data: ContractData }) => {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const startFormatted = new Date(data.startDate + "T12:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 space-y-8 print:bg-white print:text-black print:border-none print:shadow-none" id="contract-template">
      {/* Header */}
      <div className="text-center space-y-2 border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight print:text-black">
          CONTRATO DE EMPRÉSTIMO PESSOAL
        </h1>
        <p className="text-sm text-muted-foreground print:text-gray-600">
          {data.companyName} {data.companyCnpj && `• CNPJ: ${data.companyCnpj}`}
        </p>
      </div>

      {/* Parties */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider print:text-black">
          DAS PARTES
        </h2>
        <div className="bg-muted/20 rounded-xl p-4 space-y-2 text-sm print:bg-gray-50">
          <p className="text-foreground print:text-black">
            <span className="font-semibold">CREDOR:</span> {data.companyName}
            {data.companyCnpj && `, CNPJ ${data.companyCnpj}`}
          </p>
          <div className="border-t border-border/50 pt-2 mt-2" />
          <p className="text-foreground print:text-black">
            <span className="font-semibold">DEVEDOR(A):</span> {data.clientName}
          </p>
          {data.cpfCnpj && <p className="text-muted-foreground print:text-gray-600">CPF/CNPJ: {data.cpfCnpj}</p>}
          {data.phone && <p className="text-muted-foreground print:text-gray-600">Telefone: {data.phone}</p>}
          {data.email && <p className="text-muted-foreground print:text-gray-600">E-mail: {data.email}</p>}
          {data.address && <p className="text-muted-foreground print:text-gray-600">Endereço: {data.address}</p>}
        </div>
      </section>

      {/* Object */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider print:text-black">
          DO OBJETO
        </h2>
        <p className="text-sm text-foreground leading-relaxed print:text-black">
          O presente contrato tem por objeto o empréstimo pessoal no valor de{" "}
          <span className="font-bold">R$ {fmt(data.capital)}</span>, concedido pelo CREDOR ao DEVEDOR(A),
          nas condições estabelecidas neste instrumento.
        </p>
      </section>

      {/* Financial conditions */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider print:text-black">
          DAS CONDIÇÕES FINANCEIRAS
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Valor Emprestado", value: `R$ ${fmt(data.capital)}` },
            { label: "Taxa de Juros", value: `${data.interestRate}% ao ${data.frequency === "Mensal" ? "mês" : data.frequency === "Semanal" ? "semana" : "dia"}` },
            { label: "Nº de Parcelas", value: `${data.numInstallments}x` },
            { label: "Valor da Parcela", value: `R$ ${fmt(data.installmentAmount)}` },
            { label: "Total de Juros", value: `R$ ${fmt(data.totalInterest)}` },
            { label: "Total a Pagar", value: `R$ ${fmt(data.totalAmount)}` },
            { label: "Frequência", value: data.frequency },
            { label: "1º Vencimento", value: startFormatted },
          ].map(i => (
            <div key={i.label} className="bg-muted/20 rounded-lg p-3 print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider print:text-gray-500">{i.label}</p>
              <p className="font-semibold text-sm text-foreground mt-0.5 print:text-black">{i.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Penalties */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider print:text-black">
          DAS PENALIDADES POR ATRASO
        </h2>
        <div className="text-sm text-foreground leading-relaxed space-y-2 print:text-black">
          <p>
            Em caso de atraso no pagamento de qualquer parcela, incidirão sobre o valor em atraso:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Multa diária de <span className="font-bold">{data.dailyInterestPercent}%</span> sobre o valor da parcela;</li>
            <li>Multa mensal de <span className="font-bold">{data.lateFeePercent}%</span> sobre o valor da parcela;</li>
          </ul>
        </div>
      </section>

      {/* General clauses */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider print:text-black">
          DAS DISPOSIÇÕES GERAIS
        </h2>
        <div className="text-sm text-foreground leading-relaxed space-y-3 print:text-black">
          <p>
            <span className="font-semibold">Cláusula 1ª —</span> O DEVEDOR(A) se compromete a efetuar o pagamento das parcelas nas datas de vencimento estabelecidas.
          </p>
          <p>
            <span className="font-semibold">Cláusula 2ª —</span> O pagamento antecipado poderá ser realizado a qualquer momento, com desconto proporcional dos juros futuros, mediante acordo entre as partes.
          </p>
          <p>
            <span className="font-semibold">Cláusula 3ª —</span> O presente contrato é firmado em caráter irrevogável e irretratável, obrigando as partes e seus sucessores.
          </p>
          <p>
            <span className="font-semibold">Cláusula 4ª —</span> Para dirimir quaisquer dúvidas ou litígios oriundos deste contrato, fica eleito o foro da comarca do CREDOR.
          </p>
        </div>
      </section>

      {/* Signatures */}
      <section className="space-y-8 pt-6 border-t border-border">
        <p className="text-sm text-center text-muted-foreground print:text-gray-600">
          Por estarem justos e acordados, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma.
        </p>
        <p className="text-sm text-center text-muted-foreground print:text-gray-600">
          _________________, {today}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 pt-8">
          <div className="text-center space-y-2">
            <div className="border-t border-foreground/30 pt-2 mx-8 print:border-black/30" />
            <p className="text-sm font-semibold text-foreground print:text-black">{data.companyName}</p>
            <p className="text-xs text-muted-foreground print:text-gray-500">CREDOR</p>
          </div>
          <div className="text-center space-y-2">
            <div className="border-t border-foreground/30 pt-2 mx-8 print:border-black/30" />
            <p className="text-sm font-semibold text-foreground print:text-black">{data.clientName}</p>
            <p className="text-xs text-muted-foreground print:text-gray-500">DEVEDOR(A)</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContractTemplate;
