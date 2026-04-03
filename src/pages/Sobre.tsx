import eagleLogo from "@/assets/eagle-logo.webp";
import { Shield, Code, Users, Zap, Star, Globe } from "lucide-react";

const features = [
  { icon: Shield, title: "Segurança", desc: "Autenticação e RLS com Supabase" },
  { icon: Code, title: "Tecnologia", desc: "React, TypeScript e Tailwind CSS" },
  { icon: Users, title: "Multi-usuário", desc: "Controle de permissões por roles" },
  { icon: Zap, title: "Performance", desc: "Carregamento otimizado e cache" },
  { icon: Star, title: "Interface", desc: "Design premium preto e prata" },
  { icon: Globe, title: "Acessível", desc: "Responsivo para todos os dispositivos" },
];

const Sobre = () => {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card p-10 text-center animate-fade-in relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ background: "var(--gradient-gold)" }} />
        <div className="relative">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-full gold-glow" />
            <img src={eagleLogo} alt="System Juros" width={96} height={96} className="relative rounded-full ring-2 ring-primary/20" />
          </div>
          <h1 className="font-display text-3xl tracking-[0.3em] text-gradient-gold mb-2">SYSTEM JUROS</h1>
          <p className="text-muted-foreground text-sm tracking-wider">SISTEMA COMPLETO DE GESTÃO FINANCEIRA</p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted/50 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Versão 1.0.0 — Operacional
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, idx) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: `${idx * 80}ms` }}>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <f.icon size={20} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pb-4">
        © 2026 System Juros. Todos os direitos reservados.
      </div>
    </div>
  );
};

export default Sobre;
