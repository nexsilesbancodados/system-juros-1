import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    price: "97",
    description: "Ideal para pequenos operadores",
    features: [
      "Até 50 clientes",
      "Controle de parcelas",
      "Relatórios básicos",
      "Suporte via e-mail",
    ],
    cta: "Começar Agora",
    popular: false,
  },
  {
    name: "Pro",
    price: "197",
    description: "O mais escolhido pelos profissionais",
    features: [
      "Clientes ilimitados",
      "IA de Voz integrada",
      "Relatórios avançados",
      "Suporte prioritário",
      "Automações WhatsApp",
    ],
    cta: "Escolher Pro",
    popular: true,
  },
  {
    name: "Elite",
    price: "397",
    description: "Para operações de larga escala",
    features: [
      "Tudo do Pro",
      "Consultoria mensal",
      "White Label completo",
      "API de integração",
      "Gerente de conta",
    ],
    cta: "Escolher Elite",
    popular: false,
  },
];

const LandingPricing = () => {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-24 bg-black/50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-display font-bold text-white mb-6"
          >
            Planos que cabem no seu <span className="text-gradient-gold">Crescimento</span>
          </motion.h2>
          <p className="text-white/40">Escolha a melhor opção para a sua operação</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-8 rounded-3xl border ${
                plan.popular ? "bg-white/[0.05] border-white/20 scale-105" : "bg-white/[0.02] border-white/10"
              } flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest">
                  MAIS POPULAR
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-display font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-white/40 text-sm">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-white/40 text-sm">R$</span>
                  <span className="text-5xl font-bold text-white tracking-tight">{plan.price}</span>
                  <span className="text-white/40 text-sm">/mês</span>
                </div>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                    <span className="text-sm text-white/60">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate("/login")}
                className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all ${
                  plan.popular
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingPricing;
