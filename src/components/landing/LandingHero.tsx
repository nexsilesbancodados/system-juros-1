import { motion } from "framer-motion";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import eagleLogo from "@/assets/eagle-logo.webp";

const LandingHero = () => {
  const navigate = useNavigate();
  const { config } = useWhiteLabel();
  const brandTitle = config.companyName || "SYSTEM JUROS";

  return (
    <section id="home" className="relative min-h-screen pt-32 pb-20 overflow-hidden flex items-center">
      {/* Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-blue-500/[0.05] rounded-full blur-3xl -z-10" />
      <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-blue-600/[0.08] rounded-full blur-[120px] -z-10" />
      
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left Content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-white/60 tracking-wider uppercase">
                O Sistema mais completo para sua operação
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl font-display font-bold text-white leading-[1.1] mb-8"
            >
              Controle completo da sua operação de <br />
              <span className="text-gradient-gold">Empréstimos.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-white/50 mb-12 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
            >
              Gestão de empréstimos, clientes, parcelas e cobranças. Tudo o que você precisa para ter mais controle, segurança e resultados reais no seu negócio.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start"
            >
              <button
                onClick={() => navigate("/login")}
                className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-black font-bold text-sm tracking-wide hover:bg-white/90 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-white/10"
              >
                TESTE GRÁTIS POR 7 DIAS
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                className="w-full sm:w-auto px-10 py-4 rounded-full border border-white/20 text-white font-bold text-sm tracking-wide hover:bg-white/5 transition-all flex items-center justify-center gap-2"
              >
                <Play size={18} fill="white" />
                AGENDAR DEMONSTRAÇÃO
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-8"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-white/40" />
                <span className="text-xs text-white/40">Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-white/40" />
                <span className="text-xs text-white/40">Setup em minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-white/40" />
                <span className="text-xs text-white/40">Suporte especializado</span>
              </div>
            </motion.div>
          </div>

          {/* Right Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateY: -10 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex-1 relative"
          >
            <div className="relative z-10 rounded-2xl border border-white/10 bg-black shadow-[0_0_100px_-20px_rgba(255,255,255,0.1)] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
              
              {/* Fake App Mock */}
              <div className="aspect-video w-full bg-[#0a0a0a] p-4 flex flex-col gap-4">
                 {/* Sidebar Mock */}
                 <div className="flex gap-4 h-full">
                    <div className="w-12 flex flex-col gap-4">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="w-10 h-10 rounded-xl bg-white/[0.03]" />
                      ))}
                    </div>
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="h-10 rounded-xl bg-white/[0.03] w-1/3" />
                      <div className="grid grid-cols-3 gap-4">
                        {[1,2,3].map(i => (
                          <div key={i} className="h-24 rounded-2xl bg-white/[0.02] border border-white/[0.05]" />
                        ))}
                      </div>
                      <div className="flex-1 rounded-2xl bg-white/[0.01] border border-white/[0.05] p-4">
                         <div className="h-4 bg-white/[0.03] rounded w-1/4 mb-4" />
                         <div className="space-y-2">
                           {[1,2,3,4].map(i => (
                             <div key={i} className="h-8 bg-white/[0.02] rounded" />
                           ))}
                         </div>
                      </div>
                    </div>
                 </div>
              </div>

              {/* Eagle Overlay like in the screenshot */}
              <div className="absolute -right-20 -top-20 opacity-20 pointer-events-none">
                 <img src={eagleLogo} alt="" className="w-80 h-80 grayscale brightness-200" />
              </div>
            </div>

            {/* Floating elements */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-10 -left-10 p-6 glass border border-white/10 rounded-2xl hidden md:block"
            >
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Entradas Hoje</p>
              <p className="text-2xl font-bold text-white tracking-tight">R$ 15.420,00</p>
              <div className="mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-3/4" />
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, delay: 0.5 }}
              className="absolute -bottom-10 -right-10 p-6 glass border border-white/10 rounded-2xl hidden md:block"
            >
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Inadimplência</p>
              <p className="text-2xl font-bold text-red-400 tracking-tight">2.4%</p>
              <p className="text-[10px] text-green-400 mt-1">↓ 0.8% este mês</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
