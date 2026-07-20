import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LandingPricing = () => {
  const navigate = useNavigate();

  const { data: settings } = useQuery({
    queryKey: ["settings-checkout"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("mercadopago_checkout_url, hubla_checkout_url")
        .or("mercadopago_checkout_url.not.is.null,hubla_checkout_url.not.is.null")
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Error fetching checkout URL:", error);
        return null;
      }
      return data;
    },
  });

  const handleCheckout = () => {
    const url = (settings as any)?.mercadopago_checkout_url || (settings as any)?.hubla_checkout_url;
    if (url) {
      window.location.href = url;
    } else {
      navigate("/checkout");
    }
  };


  const features = [
    "Clientes ilimitados",
    "IA de Voz integrada",
    "Automações WhatsApp",
    "Relatórios avançados",
    "Gestão de cobranças",
    "Portal do Cliente",
    "Suporte prioritário",
    "Acesso PWA (Mobile App)",
  ];

  return (
    <section id="pricing" className="py-24 bg-black/50 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-display font-bold text-white mb-6"
          >
            Plano Único e <span className="text-gradient-gold">Completo</span>
          </motion.h2>
          <p className="text-white/40 max-w-xl mx-auto">
            Acesso total a todas as ferramentas de gestão, automação e IA por um preço justo e transparente.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-10 md:p-16 rounded-[3rem] bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col md:flex-row gap-12 items-center"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest shadow-lg shadow-white/20">
              OFERTA ESPECIAL
            </div>

            <div className="flex-1 space-y-8">
              <div>
                <h3 className="text-3xl font-display font-bold text-white mb-4">Acesso Ilimitado</h3>
                <p className="text-white/40 leading-relaxed">
                  Tenha em mãos a plataforma mais poderosa do mercado para gerenciar sua operação financeira com automação inteligente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-blue-400" />
                    </div>
                    <span className="text-sm text-white/70">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full md:w-[320px] p-8 rounded-3xl bg-white/[0.05] border border-white/10 text-center flex flex-col justify-center">
              <div className="mb-6">
                <span className="text-white/40 text-sm block mb-2">Por apenas</span>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-white/40 text-lg">R$</span>
                  <span className="text-6xl font-bold text-white tracking-tight">79</span>
                  <span className="text-white/40 text-lg">,00</span>
                </div>
                <span className="text-white/30 text-xs mt-2 block italic">Pagamento Mensal</span>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-5 rounded-2xl bg-white text-black font-bold text-base tracking-wide hover:bg-white/90 transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-2 group"
              >
                ASSINAR AGORA
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="text-[10px] text-white/20 mt-4 leading-relaxed">
                Pagamento seguro via Mercado Pago.<br />Cancele quando quiser.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/[0.03] rounded-full blur-[120px] -z-10" />
    </section>
  );
};

export default LandingPricing;
