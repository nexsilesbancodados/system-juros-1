import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Search, Upload, CalendarIcon } from "lucide-react";

const NovoCliente = () => {
  const navigate = useNavigate();
  const [metodoCalculo, setMetodoCalculo] = useState<"porcentagem" | "parcela">("porcentagem");
  const [frequencia, setFrequencia] = useState("Mensal");
  const [showFreqDropdown, setShowFreqDropdown] = useState(false);
  const [tipoEmprestimo, setTipoEmprestimo] = useState("Pessoal");
  const [showTipoDropdown, setShowTipoDropdown] = useState(false);

  const frequencias = ["Diária", "Semanal", "Quinzenal", "Mensal", "Manual"];
  const tiposEmprestimo = ["Pessoal", "Empresarial", "Veicular", "Imobiliário"];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Adicionar Novo Cliente de Empréstimo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preencha as informações do cliente e os detalhes do empréstimo.
        </p>
      </div>

      {/* Identificação do Cliente */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Identificação do Cliente</h2>
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Camera size={12} />
            </button>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Nome Completo</label>
              <input
                type="text"
                placeholder="Nome do Cliente"
                className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              Importar da Agenda
            </button>
          </div>
        </div>
      </section>

      {/* Informações de Contato */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Informações de Contato</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">E-mail</label>
            <input
              type="email"
              placeholder="email@exemplo.com"
              className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Telefone</label>
            <input
              type="tel"
              placeholder="+55 (00) 00000-0000"
              className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">CPF / CNPJ</label>
          <input
            type="text"
            placeholder="000.000.000-00"
            className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </section>

      {/* Endereço */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Endereço</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1 block">CEP</label>
            <input
              type="text"
              placeholder="00000-000"
              className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button className="self-end px-3 py-2.5 rounded-lg bg-accent border border-border text-foreground hover:bg-accent/70 transition-colors">
            <Search size={18} />
          </button>
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Rua</label>
            <input type="text" placeholder="Ex: Rua das Flores" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Número</label>
            <input type="text" placeholder="123" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Complemento</label>
            <input type="text" placeholder="Apto 45" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Bairro</label>
            <input type="text" placeholder="Centro" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Cidade</label>
            <input type="text" placeholder="São Paulo" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Estado</label>
            <input type="text" placeholder="SP" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      </section>

      {/* Detalhes do Empréstimo */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Detalhes do Empréstimo</h2>
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">Valor do Empréstimo (R$)</label>
          <input type="number" placeholder="0" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        {/* Método de Cálculo */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Método de Cálculo</label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${metodoCalculo === "porcentagem" ? "border-foreground" : "border-muted-foreground"}`}
                onClick={() => setMetodoCalculo("porcentagem")}
              >
                {metodoCalculo === "porcentagem" && <div className="w-2 h-2 rounded-full bg-foreground" />}
              </div>
              Por Porcentagem
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${metodoCalculo === "parcela" ? "border-foreground" : "border-muted-foreground"}`}
                onClick={() => setMetodoCalculo("parcela")}
              >
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
          <input type="number" placeholder="0" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Frequência */}
          <div className="relative">
            <label className="text-xs font-semibold text-foreground mb-1 block">Frequência</label>
            <button
              onClick={() => setShowFreqDropdown(!showFreqDropdown)}
              className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm text-left flex items-center justify-between"
            >
              {frequencia}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {showFreqDropdown && (
              <div className="absolute z-10 mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1">
                {frequencias.map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFrequencia(f); setShowFreqDropdown(false); }}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center gap-2 ${f === frequencia ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {f === frequencia && <span>✓</span>}
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Nº de Parcelas</label>
            <input type="number" placeholder="1" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Data do Empréstimo</label>
            <div className="relative">
              <input type="date" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring [color-scheme:dark]" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">1º Vencimento</label>
            <input type="date" className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring [color-scheme:dark]" />
          </div>
        </div>

        {/* Tipo de Empréstimo */}
        <div className="relative">
          <label className="text-xs font-semibold text-foreground mb-1 block">Tipo de Empréstimo</label>
          <button
            onClick={() => setShowTipoDropdown(!showTipoDropdown)}
            className="w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm text-left flex items-center justify-between"
          >
            {tipoEmprestimo}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {showTipoDropdown && (
            <div className="absolute z-10 mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1">
              {tiposEmprestimo.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTipoEmprestimo(t); setShowTipoDropdown(false); }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center gap-2 ${t === tipoEmprestimo ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {t === tipoEmprestimo && <span>✓</span>}
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Anexar Documentos */}
      <section className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Anexar Documentos</h2>
        <button className="w-full py-3 rounded-lg border border-border/50 border-dashed flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
          <Upload size={16} />
          Adicionar Arquivos
        </button>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
        <button
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-button)" }}
        >
          Salvar Cliente
        </button>
      </div>
    </div>
  );
};

export default NovoCliente;
