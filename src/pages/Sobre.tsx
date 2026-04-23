import { Shield, Code, Users, Zap, Star, Globe, Sparkles, Rocket, Heart } from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import eagleLogo from "@/assets/eagle-logo.webp";

const features = [
  { icon: Shield, title: "Segurança", desc: "Autenticação robusta com RLS no banco", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { icon: Code, title: "Tecnologia", desc: "React, TypeScript, Supabase, Vite", color: "text-cyan-400", bg: "bg-cyan-400/10" },
  { icon: Users, title: "Multi-usuário", desc: "Roles, permissões e portais externos", color: "text-violet-400", bg: "bg-violet-400/10" },
  { icon: Zap, title: "Performance", desc: "Cache inteligente e Realtime", color: "text-amber-400", bg: "bg-amber-400/10" },
  { icon: Star, title: "Interface", desc: "Design premium azul metálico", color: "text-blue-400", bg: "bg-blue-400/10" },
  { icon: Globe, title: "Acessível", desc: "Responsivo em todos os dispositivos", color: "text-rose-400", bg: "bg-rose-400/10" },
];

const stats = [
  { label: "Páginas", value: "40+", icon: Sparkles },
  { label: "Realtime", value: "100%", icon: Zap },
  { label: "Mobile", value: "First", icon: Rocket },
];

const Sobre = () => {
  const { config } = useWhiteLabel();
  const logoSrc = config.companyLogo || eagleLogo;
  const brandName = config.companyName || "SYSTEM JUROS";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero with mesh gradient */}
      <div className="page-hero text-center animate-fade-in">
        <div className="relative inline-block mb-5">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
          <img src={logoSrc} alt={brandName} width={104} height={104} className="relative rounded-2xl ring-2 ring-primary/30 shadow-[0_0_40px_hsl(var(--primary)/0.3)]" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl tracking-[0.25em] text-shimmer mb-2">{brandName}</h1>
        <p className="text-muted-foreground text-xs md:text-sm tracking-[0.2em] uppercase font-semibold">Sistema completo de gestão financeira</p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-success/30 bg-success/10 text-xs text-success font-semibold">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_hsl(var(--success))]" />
          Versão 1.0.0 — Operacional
        </div>

        {/* Stats strip */}
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-md mx-auto">
          {stats.map((s, i) => (
            <div key={s.label} className="rounded-2xl bg-card/60 border border-border/40 p-3 backdrop-blur" style={{ animationDelay: `${i * 80}ms` }}>
              <s.icon size={14} className="text-primary mx-auto mb-1" />
              <p className="text-base font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, idx) => (
          <div
            key={f.title}
            className="premium-card p-5 animate-fade-in group cursor-default"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className={`w-11 h-11 rounded-2xl ${f.bg} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
              <f.icon size={20} className={f.color} />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center pb-4 space-y-2">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          Feito com <Heart size={11} className="text-destructive fill-destructive" /> por {brandName}
        </p>
        <p className="text-[11px] text-muted-foreground/60">© {new Date().getFullYear()} {brandName}. Todos os direitos reservados.</p>
      </div>
    </div>
  );
};

export default Sobre;
