import { motion } from "framer-motion";

const LandingDashboardPreview = () => {
  return (
    <section className="py-24 bg-black overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-display font-bold text-white mb-6"
          >
            Visão Geral da sua <span className="text-gradient-gold">Operação</span>
          </motion.h2>
          <p className="text-white/40 max-w-2xl mx-auto">
            Tenha o controle total do seu negócio na palma da mão. Dados atualizados em tempo real para você decidir com confiança.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Dashboard Visual Mockup */}
          <div className="rounded-3xl border border-white/10 bg-black shadow-2xl overflow-hidden glass">
            <div className="p-1 border-b border-white/5 bg-white/[0.02] flex items-center gap-2 px-6 h-12">
               <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/40" />
               </div>
               <div className="mx-auto bg-white/5 rounded-full px-4 py-1 text-[10px] text-white/40 border border-white/5">
                  systemjuros.com.br/dashboard
               </div>
            </div>
            
            <div className="p-8 md:p-12">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  {[
                    { label: "Saldo Total", value: "R$ 1.240.500,00", color: "text-white" },
                    { label: "Parcelas Hoje", value: "R$ 15.420,00", color: "text-green-400" },
                    { label: "Atrasos (30d)", value: "R$ 4.120,00", color: "text-red-400" }
                  ].map(card => (
                    <div key={card.label} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
                       <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{card.label}</p>
                       <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                     <div className="h-64 rounded-2xl bg-white/[0.02] border border-white/5 p-6 relative overflow-hidden">
                        <p className="text-xs text-white/40 mb-4">Fluxo de Caixa (Mensal)</p>
                        <div className="absolute inset-0 top-12 p-6 flex items-end gap-2">
                           {[40, 60, 45, 80, 55, 90, 70, 85, 65, 95, 75, 100].map((h, i) => (
                             <div key={i} className="flex-1 bg-gradient-to-t from-white/20 to-white/5 rounded-t-sm" style={{ height: `${h}%` }} />
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="space-y-6">
                     <div className="h-64 rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                        <p className="text-xs text-white/40 mb-6">Últimas Atividades</p>
                        <div className="space-y-4">
                           {[1,2,3,4].map(i => (
                             <div key={i} className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-white/5" />
                                <div className="flex-1 h-2 bg-white/[0.03] rounded" />
                                <div className="w-12 h-2 bg-white/[0.03] rounded" />
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          {/* Glowing Accents */}
          <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-white/[0.05] rounded-full blur-[120px]" />
        </motion.div>
      </div>
    </section>
  );
};

export default LandingDashboardPreview;
