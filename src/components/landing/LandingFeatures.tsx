import { motion } from "framer-motion";
import { Users, FileText, BarChart3, Bell, Shield, Smartphone } from "lucide-react";

const features = [
  {
    title: "Gestão de Clientes",
    description: "Cadastre, edite e gerencie todos os seus clientes em um só lugar de forma intuitiva.",
    icon: <Users size={24} className="text-white/60" />,
  },
  {
    title: "Controle de Parcelas",
    description: "Acompanhe parcelas, vencimentos, pagamentos e inadimplência de forma simples.",
    icon: <FileText size={24} className="text-white/60" />,
  },
  {
    title: "Relatórios Avançados",
    description: "Dashboards completos com gráficos e indicadores para melhores decisões no seu negócio.",
    icon: <BarChart3 size={24} className="text-white/60" />,
  },
  {
    title: "Alertas e Lembretes",
    description: "Receba avisos automáticos de vencimentos e parcelas em aberto diretamente no seu painel.",
    icon: <Bell size={24} className="text-white/60" />,
  },
  {
    title: "Segurança Total",
    description: "Seus dados protegidos com criptografia e backup diário na nuvem com total privacidade.",
    icon: <Shield size={24} className="text-white/60" />,
  },
  {
    title: "Acesso em Qualquer Lugar",
    description: "Use o sistema de onde estiver, no computador, tablet ou celular com tecnologia PWA.",
    icon: <Smartphone size={24} className="text-white/60" />,
  },
];

const LandingFeatures = () => {
  return (
    <section id="features" className="py-24 relative overflow-hidden bg-black">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-display font-bold text-white mb-6"
          >
            Recursos feitos para sua <span className="text-gradient-gold">Produtividade</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-white/40 max-w-2xl mx-auto"
          >
            Tudo o que você precisa para gerenciar sua carteira de empréstimos com eficiência e sem complicações.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-xl font-display font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
