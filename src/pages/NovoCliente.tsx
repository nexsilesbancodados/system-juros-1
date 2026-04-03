import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const NovoCliente = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

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

    const { error } = await supabase.from("clients").insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      name: nome.trim(),
      email: email.trim() || null,
      phone: telefone.trim() || null,
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

    toast({ title: "Sucesso!", description: "Cliente cadastrado com sucesso." });
    navigate("/clientes");
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/clientes")} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Cadastrar Novo Cliente</h1>
          <p className="text-sm text-muted-foreground mt-1">Preencha as informações do cliente. Para criar um empréstimo, use Novo Contrato.</p>
        </div>
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

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => navigate("/clientes")} className="px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
          {saving ? "Salvando..." : "Salvar Cliente"}
        </button>
      </div>
    </div>
  );
};

export default NovoCliente;