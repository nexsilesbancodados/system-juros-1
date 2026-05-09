import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const LandingCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-white/[0.02] -z-10" />
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto rounded-[3rem] bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 p-12 md:p-20 text-center relative overflow-hidden">
          {/* Decorative Glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-[80px]" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-[80px]" />

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-display font-bold text-white mb-8"
          >
            Pronto para transformar sua <br />
            <span className="text-gradient-gold">gestão financeira?</span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-white/40 mb-12 max-w-xl mx-auto leading-relaxed"
          >
            Teste grátis por 7 dias e descubra como o System Juros pode levar seu negócio para o próximo nível com automação e IA.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <button
              onClick={() => navigate("/login")}
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-black font-bold text-sm tracking-wide hover:bg-white/90 transition-all shadow-xl shadow-white/10"
            >
              TESTE GRÁTIS POR 7 DIAS
            </button>
            <button
              className="w-full sm:w-auto px-10 py-4 rounded-full border border-white/20 text-white font-bold text-sm tracking-wide hover:bg-white/5 transition-all"
            >
              OU AGENDE UMA DEMONSTRAÇÃO
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LandingCTA;
