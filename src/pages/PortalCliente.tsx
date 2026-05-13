import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, ArrowRight, Shield, User, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PortalCliente = () => {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientData, setClientData] = useState<any>(null);

  const formatCpf = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    return nums.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) =>
      [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : "")
    );
  };

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length < 11) {
      toast({ title: "CPF inválido", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    try {
      const { data: clients, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("cpf_cnpj", cleanCpf)
        .eq("birth_date", birthDate);

      if (clientError || !clients || clients.length === 0) {
        toast({ title: "Acesso negado", variant: "destructive" });
        setLoading(false);
        return;
      }

      setClientData(clients[0]);
      toast({ title: "Acesso autorizado!" });
    } catch (err) {
      toast({ title: "Erro no acesso", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="w-full max-w-md space-y-8 bg-slate-900 border border-white/10 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
        
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto border border-primary/20">
            <Shield size={40} className="text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Portal <span className="text-primary">VIP</span></h1>
          <p className="text-slate-400 text-sm">Acesse seus dados financeiros com segurança</p>
        </div>

        {!clientData ? (
          <form onSubmit={handleAccess} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">CPF</label>
              <input
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                required
                className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-center text-xl font-mono text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Data de Nascimento</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-center text-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50 [color-scheme:dark]"
              />
            </div>
            
            <div className="pt-2">
              <Button type="submit" disabled={loading} className="w-full py-7 rounded-xl text-lg font-bold shadow-xl shadow-primary/20">
                {loading ? <Clock className="animate-spin mr-2" /> : <ArrowRight className="mr-2" />}
                {loading ? "Verificando..." : "Entrar no Portal"}
              </Button>
            </div>
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCpf("100.200.300-10");
                setBirthDate("1990-01-01");
              }}
              className="w-full py-4 text-white/40 hover:text-white/60 hover:bg-white/5"
            >
              Usar Credenciais de Teste
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-6 py-8">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto border border-success/20">
              <User size={32} className="text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Olá, {clientData.name.split(' ')[0]}!</h2>
              <p className="text-slate-400">Seu portal foi carregado com sucesso.</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full py-6 rounded-xl border-white/10 hover:bg-white/5">
              Sair com Segurança
            </Button>
          </div>
        )}
        
        <div className="pt-4 text-center">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">Criptografia de Ponta a Ponta</p>
        </div>
      </div>
    </div>
  );
};

export default PortalCliente;