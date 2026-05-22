import { motion } from "framer-motion";
import { Check, Sparkles, Shield, Zap, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import LandingPricing from "@/components/landing/LandingPricing";
import ConstellationBackground from "@/components/ConstellationBackground";

const faqs = [
  {
    q: "Como funciona o teste grátis de 3 dias?",
    a: "Você cria sua conta sem informar cartão de crédito e recebe acesso completo a todas as funcionalidades por 3 dias. Após esse período, basta assinar para continuar usando — todos os seus dados ficam preservados.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. A assinatura é mensal e sem fidelidade. Cancele com 1 clique na sua área de perfil ou pelo Hubla a qualquer momento.",
  },
  {
    q: "O que está incluído no plano?",
    a: "Tudo: clientes ilimitados, contratos, IA de cobrança, automações de WhatsApp, portal do cliente, portal do cobrador, relatórios avançados, app mobile (PWA) e suporte prioritário.",
  },
  {
    q: "Como recebo acesso após pagar?",
    a: "Logo após a confirmação do pagamento pelo Hubla, você recebe automaticamente um e-mail com um link mágico para entrar no sistema sem precisar de senha.",
  },
  {
    q: "Posso usar no celular?",
    a: "Sim! O System Juros é um PWA — instale como app no Android/iPhone diretamente do navegador, sem precisar baixar da loja.",
  },
];

const Planos = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <ConstellationBackground />

      <button
        onClick={() => navigate("/")}
        className="fixed top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] transition-all backdrop-blur-md"
      >
        <ArrowLeft size={16} />
        <span className="text-sm">Voltar</span>
      </button>

      {/* Hero */}
      <section className="relative pt-32 pb-12 px-6">
        <div className="container mx-auto text-center max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-white/60 uppercase tracking-widest mb-6"
          >
            <Sparkles size={12} className="text-amber-400" />
            Plano único · sem complicação
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-display font-bold mb-6 leading-tight"
          >
            Escolha como quer <br />
            <span className="text-gradient-gold">começar hoje</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/50 text-lg leading-relaxed"
          >
            Teste sem cartão por 3 dias ou assine agora e tenha acesso imediato a todas as ferramentas.
          </motion.p>
        </div>
      </section>

      {/* Pricing card */}
      <LandingPricing />

      {/* Benefits */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Ativação imediata", desc: "Acesso liberado em segundos após o pagamento via link mágico no e-mail." },
            { icon: Shield, title: "Pagamento seguro", desc: "Processado pela Hubla — PIX, cartão ou boleto. Sem fidelidade." },
            { icon: Sparkles, title: "Atualizações inclusas", desc: "Todo recurso novo já vem incluso no seu plano, sem custo extra." },
          ].map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center mb-4">
                <b.icon size={18} className="text-amber-400" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{b.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-12">
            Perguntas <span className="text-gradient-gold">frequentes</span>
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition"
                >
                  <span className="font-medium text-white pr-4">{faq.q}</span>
                  <span className={`text-amber-400 text-xl transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-white/60 leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-10 text-center text-white/30 text-xs tracking-wider">
        © 2025 SYSTEM JUROS · TODOS OS DIREITOS RESERVADOS
      </footer>
    </div>
  );
};

export default Planos;
