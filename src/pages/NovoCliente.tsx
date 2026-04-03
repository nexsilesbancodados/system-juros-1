import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Search, ArrowLeft, User, Phone, Mail, MapPin, CreditCard, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const NovoCliente = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // Improvement #30: Phone mask
  const formatPhone = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 2) return nums;
    if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
  };

  // Improvement #31: CPF/CNPJ mask
  const formatCpfCnpj = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 14);
    if (nums.length <= 11) {
      return nums.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) =>
        [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : "")
      );
    }
    return nums.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d, e) =>
      a + (b ? `.${b}` : "") + (c ? `.${c}` : "") + (d ? `/${d}` : "") + (e ? `-${e}` : "")
    );
  };

  // Improvement #32: CEP mask + auto-fetch
  const formatCep = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 8);
    if (nums.length > 5) return `${nums.slice(0,5)}-${nums.slice(5)}`;
    return nums;
  };

  const buscarCep = async (value?: string) => {
    const raw = (value || cep).replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setRua(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
        toast({ title: "CEP encontrado!" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {} finally { setCepLoading(false); }
  };

  const handleCepChange = (v: string) => {
    const formatted = formatCep(v);
    setCep(formatted);
    if (formatted.replace(/\D/g, "").length === 8) {
      buscarCep(formatted);
    }
  };

  // Improvement #33: Form validation feedback
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));
  const isInvalid = (field: string, value: string) => touched[field] && !value.trim();

  const handleSave = async () => {
    if (!user) return;
    if (!nome.trim()) {
      setTouched({ nome: true });
      toast({ title: "Nome obrigatório", description: "Preencha o nome do cliente.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("clients").insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      name: nome.trim(),
      email: email.trim() || null,
      phone: telefone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      cpf_cnpj: cpfCnpj.trim() || null,
      client_type: "loan",
      status: "Ativo",
      address: rua ? { cep, street: rua, number: numero, complement: complemento, neighborhood: bairro, city: cidade, state: estado } : null,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "✓ Cliente cadastrado!", description: "Agora você pode criar contratos para este cliente." });
    navigate("/clientes");
  };

  const inputClass = (field?: string) => `w-full px-3.5 py-2.5 rounded-2xl bg-card border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none transition-all duration-200 input-enhanced ${
    field && isInvalid(field, field === "nome" ? nome : "") ? "border-destructive ring-1 ring-destructive/30" : "border-border focus:border-ring"
  }`;

  // Improvement #34: Progress indicator
  const progress = [nome, telefone || whatsapp, cpfCnpj].filter(Boolean).length;
  const progressPct = Math.round((progress / 3) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/clientes")} className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors focus-ring">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Cadastrar Novo Cliente</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Preencha os dados. Campos com * são obrigatórios.</p>
        </div>
      </div>

      {/* Improvement #35: Form progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%`, background: progressPct === 100 ? "hsl(var(--success))" : "var(--gradient-gold)" }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{progressPct}%</span>
      </div>

      {/* Identificação */}
      <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4 card-shine">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
            <User size={16} className="text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Identificação</h2>
        </div>
        <div className="flex items-start gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground bg-muted/30">
              <User size={24} />
            </div>
            <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:scale-110 transition-all">
              <Camera size={12} />
            </button>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Nome Completo *</label>
              <input
                type="text" placeholder="Nome do Cliente" value={nome}
                onChange={(e) => setNome(e.target.value)}
                onBlur={() => markTouched("nome")}
                className={inputClass("nome")}
              />
              {isInvalid("nome", nome) && (
                <p className="text-xs text-destructive mt-1 animate-fade-in">Nome é obrigatório</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">CPF / CNPJ</label>
              <input
                type="text" placeholder="000.000.000-00" value={cpfCnpj}
                onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                className={inputClass()} inputMode="numeric"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contato */}
      <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4 card-shine">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-info/8 flex items-center justify-center">
            <Phone size={16} className="text-info" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Contato</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">E-mail</label>
            <input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Telefone</label>
            <input type="tel" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(formatPhone(e.target.value))} className={inputClass()} inputMode="tel" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-foreground mb-1.5 block">WhatsApp</label>
            <input type="tel" placeholder="(00) 00000-0000" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} className={inputClass()} inputMode="tel" />
            {/* Improvement #36: Helper text */}
            <p className="text-[10px] text-muted-foreground mt-1">Usado para enviar cobranças automáticas</p>
          </div>
        </div>
      </section>

      {/* Endereço */}
      <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4 card-shine">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-warning/8 flex items-center justify-center">
            <MapPin size={16} className="text-warning" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Endereço</h2>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1.5 block">CEP</label>
            <input type="text" placeholder="00000-000" value={cep} onChange={(e) => handleCepChange(e.target.value)} className={inputClass()} inputMode="numeric" />
          </div>
          <button
            onClick={() => buscarCep()}
            disabled={cepLoading}
            className="self-end px-4 py-2.5 rounded-2xl bg-accent border border-border text-foreground hover:bg-accent/70 transition-all disabled:opacity-50 focus-ring"
          >
            {cepLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </div>
        {/* Improvement #37: Show filled address with visual feedback */}
        {rua && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/15 text-xs text-success animate-fade-in">
            <Check size={14} />
            <span>Endereço preenchido automaticamente</span>
          </div>
        )}
        <div className="grid grid-cols-[1fr_100px] gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Rua</label>
            <input type="text" placeholder="Ex: Rua das Flores" value={rua} onChange={(e) => setRua(e.target.value)} className={inputClass()} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Número</label>
            <input type="text" placeholder="123" value={numero} onChange={(e) => setNumero(e.target.value)} className={inputClass()} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Complemento</label>
            <input type="text" placeholder="Apto 45" value={complemento} onChange={(e) => setComplemento(e.target.value)} className={inputClass()} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Bairro</label>
            <input type="text" placeholder="Centro" value={bairro} onChange={(e) => setBairro(e.target.value)} className={inputClass()} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Cidade</label>
            <input type="text" placeholder="São Paulo" value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputClass()} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Estado</label>
            <input type="text" placeholder="SP" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} className={inputClass()} />
          </div>
        </div>
      </section>

      {/* Improvement #38: Sticky action bar */}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 p-4 rounded-2xl glass-strong border border-border/50">
        <button onClick={() => navigate("/clientes")} className="px-5 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all focus-ring">
          Cancelar
        </button>
        <button
          onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all hover:shadow-lg focus-ring"
          style={{ background: "var(--gradient-button)" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? "Salvando..." : "Salvar Cliente"}
        </button>
      </div>
    </div>
  );
};

export default NovoCliente;
