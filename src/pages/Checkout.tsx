import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { toast } from "sonner";

const FEATURES = [
  "Clientes e contratos ilimitados",
  "Agente de IA no WhatsApp",
  "Cálculo automático de multas e juros",
  "Portal do Cliente white-label",
  "Relatórios financeiros avançados",
  "Automações de cobrança",
  "App PWA (Android/iPhone)",
  "Suporte prioritário",
];

export default function Checkout() {
  const navigate = useNavigate();
  const { config } = useWhiteLabel();
  const brand = config.companyName || "CredMais App";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = `Checkout — ${brand}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", `Assine o ${brand} e libere a gestão profissional de empréstimos com IA.`);
  }, [brand]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-create-preference", {
        body: { email, name },
      });
      if (error) throw error;
      const url = (data as any)?.init_point || (data as any)?.sandbox_init_point;
      if (!url) throw new Error("URL de checkout indisponível.");
      window.location.href = url;
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Falha ao iniciar o checkout. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-blue-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-400/5 rounded-full blur-[120px]" />
      </div>

      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="text-sm font-bold tracking-wider text-white/80 hover:text-white">
          ← {brand}
        </button>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Lock size={14} /> Pagamento seguro via Mercado Pago
        </div>
      </header>

      <main className="container mx-auto px-6 pb-24 pt-8 grid lg:grid-cols-[1.05fr_1fr] gap-10 max-w-6xl">
        {/* Plan summary */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-8 md:p-10 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-6">
            <Sparkles size={12} /> Plano recomendado
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">Acesso Ilimitado</h1>
          <p className="text-white/50 leading-relaxed mb-8">
            Toda a plataforma {brand} liberada. Sem limites de clientes, contratos ou automações.
          </p>

          <div className="flex items-baseline gap-2 mb-8">
            <span className="text-white/40 text-lg">R$</span>
            <span className="text-6xl font-bold tracking-tight">79</span>
            <span className="text-white/40 text-lg">,00</span>
            <span className="text-white/40 text-sm ml-2">/mês</span>
          </div>

          <ul className="grid sm:grid-cols-2 gap-3 mb-8">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-white/80">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Check size={12} className="text-blue-300" />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4 pt-6 border-t border-white/10 text-xs text-white/50">
            <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-400" /> Criptografia SSL</div>
            <div className="flex items-center gap-2"><Lock size={14} className="text-blue-300" /> Cancele quando quiser</div>
          </div>
        </motion.section>

        {/* Form */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-8 md:p-10 rounded-[2rem] bg-white/[0.04] border border-white/10 backdrop-blur-xl h-fit sticky top-6"
        >
          <h2 className="text-xl font-bold mb-2">Finalizar assinatura</h2>
          <p className="text-sm text-white/50 mb-8">Preencha seus dados para prosseguir ao pagamento seguro.</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2 block">Seu nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como você quer ser chamado"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60 focus:bg-white/[0.07] transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2 block">E-mail *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60 focus:bg-white/[0.07] transition-all"
              />
              <p className="text-[11px] text-white/40 mt-2">Após o pagamento você receberá um link mágico neste e-mail para acessar sua conta.</p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-xs text-white/50">Total mensal</div>
                <div className="text-2xl font-bold">R$ 79,00</div>
              </div>
              <div className="text-[10px] text-white/40 text-right leading-tight">
                Renovação<br />automática
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base tracking-wide hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Redirecionando...</>
              ) : (
                <>Ir para pagamento seguro <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>

            <p className="text-[11px] text-white/30 text-center leading-relaxed">
              Ao continuar você concorda com os <a href="/privacidade" className="underline hover:text-white/60">Termos e Política de Privacidade</a>.
            </p>
          </form>
        </motion.section>
      </main>
    </div>
  );
}
