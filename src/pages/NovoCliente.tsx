import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Search, ArrowLeft, User, Phone, Mail, MapPin, Check, Loader2, Copy, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Validation helpers
const validateCPF = (cpf: string): boolean => {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(nums[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(nums[10]);
};

const validateCNPJ = (cnpj: string): boolean => {
  const nums = cnpj.replace(/\D/g, "");
  if (nums.length !== 14 || /^(\d)\1+$/.test(nums)) return false;
  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(nums[i]) * weights1[i];
  let rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  if (rest !== parseInt(nums[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(nums[i]) * weights2[i];
  rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  return rest === parseInt(nums[13]);
};

const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const NovoCliente = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

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

  const formatPhone = (v: string) => {
    const nums = v.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 2) return nums;
    if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
  };

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
    if (formatted.replace(/\D/g, "").length === 8) buscarCep(formatted);
  };

  // Touched state for validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  // Validation errors
  const errors: Record<string, string | null> = {
    nome: touched.nome && !nome.trim() ? "Nome é obrigatório" : null,
    email: touched.email && email.trim() && !validateEmail(email) ? "E-mail inválido" : null,
    cpfCnpj: touched.cpfCnpj && cpfCnpj.trim() ? (() => {
      const nums = cpfCnpj.replace(/\D/g, "");
      if (nums.length === 11 && !validateCPF(cpfCnpj)) return "CPF inválido";
      if (nums.length === 14 && !validateCNPJ(cpfCnpj)) return "CNPJ inválido";
      if (nums.length > 0 && nums.length < 11) return "CPF/CNPJ incompleto";
      return null;
    })() : null,
    telefone: touched.telefone && telefone.trim() && telefone.replace(/\D/g, "").length < 10 ? "Telefone incompleto" : null,
  };

  // Copy phone to whatsapp
  const copyPhoneToWhatsapp = useCallback(() => {
    if (telefone.trim()) {
      setWhatsapp(telefone);
      toast({ title: "Telefone copiado para WhatsApp" });
    }
  }, [telefone, toast]);

  const handleSave = async () => {
    if (!user) return;

    // Mark all required as touched
    setTouched({ nome: true, email: true, cpfCnpj: true, telefone: true });

    if (!nome.trim()) {
      toast({ title: "Nome obrigatório", description: "Preencha o nome do cliente.", variant: "destructive" });
      return;
    }

    // Check for validation errors
    if (email.trim() && !validateEmail(email)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }

    const cpfNums = cpfCnpj.replace(/\D/g, "");
    if (cpfNums.length === 11 && !validateCPF(cpfCnpj)) {
      toast({ title: "CPF inválido", description: "Verifique os dígitos.", variant: "destructive" });
      return;
    }
    if (cpfNums.length === 14 && !validateCNPJ(cpfCnpj)) {
      toast({ title: "CNPJ inválido", description: "Verifique os dígitos.", variant: "destructive" });
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

  const inputClass = (field?: string) => `w-full px-3.5 py-2.5 rounded-2xl bg-card border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none transition-all duration-150 input-enhanced ${
    field && errors[field] ? "border-destructive ring-1 ring-destructive/30" : "border-border focus:border-ring"
  }`;

  // Progress: nome (required), contact (telefone or whatsapp), document (cpfCnpj)
  const progress = [nome, telefone || whatsapp, cpfCnpj].filter(Boolean).length;
  const progressPct = Math.round((progress / 3) * 100);

  const cpfCnpjLabel = (() => {
    const nums = cpfCnpj.replace(/\D/g, "");
    if (nums.length > 11) return "CNPJ";
    return "CPF / CNPJ";
  })();

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

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%`, background: progressPct === 100 ? "hsl(var(--success))" : "var(--gradient-gold)" }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{progressPct}%</span>
      </div>

      {/* Identificação */}
      <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
            <User size={16} className="text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Identificação</h2>
        </div>
        <div className="flex items-start gap-5">
          <div className="relative flex-shrink-0 group">
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground bg-muted/30 overflow-hidden">
              {avatarPreview ? <img src={avatarPreview} alt="" className="w-16 h-16 object-cover" /> : <User size={24} />}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform" style={{ background: "var(--gradient-button)" }}>
              <Camera size={12} className="text-white" />
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
              }} className="hidden" />
            </label>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Nome Completo *</label>
              <input
                type="text" placeholder="Nome do Cliente" value={nome}
                onChange={(e) => setNome(e.target.value)}
                onBlur={() => markTouched("nome")}
                className={inputClass("nome")}
                autoFocus
              />
              {errors.nome && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.nome}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{cpfCnpjLabel}</label>
              <input
                type="text"
                placeholder={cpfCnpj.replace(/\D/g, "").length > 11 ? "00.000.000/0000-00" : "000.000.000-00"}
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                onBlur={() => markTouched("cpfCnpj")}
                className={inputClass("cpfCnpj")}
                inputMode="numeric"
              />
              {errors.cpfCnpj && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.cpfCnpj}</p>
              )}
              {touched.cpfCnpj && cpfCnpj.trim() && !errors.cpfCnpj && cpfCnpj.replace(/\D/g, "").length >= 11 && (
                <p className="text-xs text-success mt-1 flex items-center gap-1"><Check size={12} /> {cpfCnpj.replace(/\D/g, "").length <= 11 ? "CPF" : "CNPJ"} válido</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contato */}
      <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-info/8 flex items-center justify-center">
            <Phone size={16} className="text-info" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Contato</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">E-mail</label>
            <input
              type="email" placeholder="email@exemplo.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched("email")}
              className={inputClass("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.email}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Telefone</label>
            <input
              type="tel" placeholder="(00) 00000-0000" value={telefone}
              onChange={(e) => setTelefone(formatPhone(e.target.value))}
              onBlur={() => markTouched("telefone")}
              className={inputClass("telefone")}
              inputMode="tel"
            />
            {errors.telefone && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.telefone}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">WhatsApp</label>
              {telefone.trim() && !whatsapp.trim() && (
                <button
                  type="button"
                  onClick={copyPhoneToWhatsapp}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
                >
                  <Copy size={10} /> Copiar do telefone
                </button>
              )}
            </div>
            <input type="tel" placeholder="(00) 00000-0000" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} className={inputClass()} inputMode="tel" />
            <p className="text-[10px] text-muted-foreground mt-1">Usado para enviar cobranças automáticas</p>
          </div>
        </div>
      </section>

      {/* Endereço */}
      <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-warning/8 flex items-center justify-center">
            <MapPin size={16} className="text-warning" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Endereço</h2>
          <span className="text-[10px] text-muted-foreground ml-auto">(opcional)</span>
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
        {rua && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/15 text-xs text-success">
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
            <input type="text" placeholder="123" value={numero} onChange={(e) => setNumero(e.target.value)} className={inputClass()} inputMode="numeric" />
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
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={`${inputClass()} appearance-none`}
            >
              <option value="">Selecione</option>
              {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Action bar */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 p-4 rounded-2xl glass-strong border border-border/50">
        <div className="text-xs text-muted-foreground hidden sm:block">
          {progressPct === 100 ? (
            <span className="text-success flex items-center gap-1"><Check size={12} /> Pronto para salvar</span>
          ) : (
            "Preencha os campos obrigatórios"
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <button onClick={() => navigate("/clientes")} className="px-5 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all focus-ring">
            Cancelar
          </button>
          <button
            onClick={handleSave} disabled={saving || !nome.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50 transition-all hover:shadow-lg focus-ring"
            style={{ background: "var(--gradient-button)" }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Salvando..." : "Salvar Cliente"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NovoCliente;
