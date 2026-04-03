import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Search, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const NovoCliente = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [metodoCalculo, setMetodoCalculo] = useState<"porcentagem" | "parcela">("porcentagem");
  const [frequencia, setFrequencia] = useState("Mensal");
  const [showFreqDropdown, setShowFreqDropdown] = useState(false);
  const [tipoEmprestimo, setTipoEmprestimo] = useState("Pessoal");
  const [showTipoDropdown, setShowTipoDropdown] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [valorEmprestimo, setValorEmprestimo] = useState("");
  const [taxaOuParcela, setTaxaOuParcela] = useState("");
  const [numParcelas, setNumParcelas] = useState("");
  const [dataEmprestimo, setDataEmprestimo] = useState("");
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");

  const frequencias = ["Diária", "Semanal", "Quinzenal", "Mensal", "Manual"];
  const tiposEmprestimo = ["Pessoal", "Empresarial", "Veicular", "Imobiliário"];

  const buscarCep = async () => {
    if (cep.replace(/\D/g, "").length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, "")}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setRua(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
      }
    } catch {}
  };

  const handleSave = async () => {
    if (!user) return;
    if (!nome.trim()) {
      toast({ title: "Erro", description: "Nome do cliente é obrigatório.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const valor = parseFloat(valorEmprestimo) || 0;
    const taxa = parseFloat(taxaOuParcela) || 0;
    const parcelas = parseInt(numParcelas) || 1;

    let valorParcela = 0;
    let jurosTotal = 0;
    if (metodoCalculo === "porcentagem") {
      jurosTotal = valor * (taxa / 100) * parcelas;
      valorParcela = (valor + jurosTotal) / parcelas;
    } else {
      valorParcela = taxa;
      jurosTotal = (taxa * parcelas) - valor;
    }

    const loanData = valor > 0 ? {
      amount: valor,
      interest_rate: metodoCalculo === "porcentagem" ? taxa : null,
      installment_value: valorParcela,
      total_interest: jurosTotal,
      total_amount: valor + jurosTotal,
      installments: parcelas,
      frequency: frequencia,
      type: tipoEmprestimo,
      calculation_method: metodoCalculo,
      start_date: dataEmprestimo || null,
      first_due_date: primeiroVencimento || null,
      paid_installments: 0,
    } : null;

    const { error } = await supabase.from("clients").insert({
      user_id: user.id,
      name: nome.trim(),
      email: email.trim() || null,
      phone: telefone.trim() || null,
      cpf_cnpj: cpfCnpj.trim() || null,
      client_type: "loan",
      status: "Ativo",
      address: rua ? { cep, street: rua, number: numero, complement: complemento, neighborhood: bairro, city: cidade, state: estado } : null,
      loan: loanData,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso!", description: "Cliente cadastrado com sucesso." });
      navigate("/clientes");
    }
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-foreground">Adicionar Novo Cliente de Empréstimo</h1>
        <p className="text-sm text-muted-foreground mt-1">Preencha as informações do cliente e os detalhes do empréstimo.</p>
      </div>

      {/* Identificação */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Identificação do Cliente</h2>
        <div className="flex items-start gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Camera size={12} />
            </button>
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1 block">Nome Completo *</label>
            <input type="text" placeholder="Nome do Cliente" value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
          </div>
        </div>
      </section>

      {/* Contato */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Informações de Contato</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">E-mail</label>
            <input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Telefone</label>
            <input type="tel" placeholder="+55 (00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">CPF / CNPJ</label>
          <input type="text" placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className={inputClass} />
        </div>
      </section>

      {/* Endereço */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Endereço</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1 block">CEP</label>
            <input type="text" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} className={inputClass} />
          </div>
          <button onClick={buscarCep} className="self-end px-3 py-2.5 rounded-lg bg-accent border border-border text-foreground hover:bg-accent/70 transition-colors">
            <Search size={18} />
          </button>
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Rua</label>
            <input type="text" placeholder="Ex: Rua das Flores" value={rua} onChange={(e) => setRua(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Número</label>
            <input type="text" placeholder="123" value={numero} onChange={(e) => setNumero(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Complemento</label>
            <input type="text" placeholder="Apto 45" value={complemento} onChange={(e) => setComplemento(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Bairro</label>
            <input type="text" placeholder="Centro" value={bairro} onChange={(e) => setBairro(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Cidade</label>
            <input type="text" placeholder="São Paulo" value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Estado</label>
            <input type="text" placeholder="SP" value={estado} onChange={(e) => setEstado(e.target.value)} className={inputClass} />
          </div>
        </div>
      </section>

      {/* Empréstimo */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Detalhes do Empréstimo</h2>
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">Valor do Empréstimo (R$)</label>
          <input type="number" placeholder="0" value={valorEmprestimo} onChange={(e) => setValorEmprestimo(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Método de Cálculo</label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${metodoCalculo === "porcentagem" ? "border-foreground" : "border-muted-foreground"}`} onClick={() => setMetodoCalculo("porcentagem")}>
                {metodoCalculo === "porcentagem" && <div className="w-2 h-2 rounded-full bg-foreground" />}
              </div>
              Por Porcentagem
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${metodoCalculo === "parcela" ? "border-foreground" : "border-muted-foreground"}`} onClick={() => setMetodoCalculo("parcela")}>
                {metodoCalculo === "parcela" && <div className="w-2 h-2 rounded-full bg-foreground" />}
              </div>
              Por Valor da Parcela
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">
            {metodoCalculo === "porcentagem" ? "Taxa de Juros (%)" : "Valor da Parcela (R$)"}
          </label>
          <input type="number" placeholder="0" value={taxaOuParcela} onChange={(e) => setTaxaOuParcela(e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <label className="text-xs font-semibold text-foreground mb-1 block">Frequência</label>
            <button onClick={() => setShowFreqDropdown(!showFreqDropdown)} className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm text-left flex items-center justify-between">
              {frequencia}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {showFreqDropdown && (
              <div className="absolute z-10 mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1">
                {frequencias.map((f) => (
                  <button key={f} onClick={() => { setFrequencia(f); setShowFreqDropdown(false); }} className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${f === frequencia ? "text-foreground" : "text-muted-foreground"}`}>
                    {f === frequencia && "✓ "}{f}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Nº de Parcelas</label>
            <input type="number" placeholder="1" value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Data do Empréstimo</label>
            <input type="date" value={dataEmprestimo} onChange={(e) => setDataEmprestimo(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">1º Vencimento</label>
            <input type="date" value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
          </div>
        </div>

        <div className="relative">
          <label className="text-xs font-semibold text-foreground mb-1 block">Tipo de Empréstimo</label>
          <button onClick={() => setShowTipoDropdown(!showTipoDropdown)} className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm text-left flex items-center justify-between">
            {tipoEmprestimo}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {showTipoDropdown && (
            <div className="absolute z-10 mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1">
              {tiposEmprestimo.map((t) => (
                <button key={t} onClick={() => { setTipoEmprestimo(t); setShowTipoDropdown(false); }} className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${t === tipoEmprestimo ? "text-foreground" : "text-muted-foreground"}`}>
                  {t === tipoEmprestimo && "✓ "}{t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resumo do cálculo */}
        {parseFloat(valorEmprestimo) > 0 && (
          <div className="rounded-lg bg-accent/30 border border-border p-4 space-y-1">
            <p className="text-xs font-semibold text-foreground mb-2">Resumo do Empréstimo</p>
            {(() => {
              const valor = parseFloat(valorEmprestimo) || 0;
              const taxa = parseFloat(taxaOuParcela) || 0;
              const parcelas = parseInt(numParcelas) || 1;
              let valorParcela = 0, juros = 0;
              if (metodoCalculo === "porcentagem") {
                juros = valor * (taxa / 100) * parcelas;
                valorParcela = (valor + juros) / parcelas;
              } else {
                valorParcela = taxa;
                juros = (taxa * parcelas) - valor;
              }
              return (
                <>
                  <p className="text-sm text-muted-foreground">Capital: <span className="text-foreground font-medium">R$ {valor.toFixed(2)}</span></p>
                  <p className="text-sm text-muted-foreground">Juros Total: <span className="text-foreground font-medium">R$ {juros.toFixed(2)}</span></p>
                  <p className="text-sm text-muted-foreground">Total a Receber: <span className="text-green-400 font-medium">R$ {(valor + juros).toFixed(2)}</span></p>
                  <p className="text-sm text-muted-foreground">Valor da Parcela: <span className="text-foreground font-medium">R$ {valorParcela.toFixed(2)}</span></p>
                </>
              );
            })()}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => navigate("/clientes")} className="px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
          {saving ? "Salvando..." : "Salvar Cliente"}
        </button>
      </div>
    </div>
  );
};

export default NovoCliente;
