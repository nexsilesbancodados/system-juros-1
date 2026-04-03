import { useState } from "react";
import ConstellationBackground from "@/components/ConstellationBackground";
import eagleLogo from "@/assets/eagle-logo.png";

const Index = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate auth
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-body">
      <ConstellationBackground />

      {/* Logo & Title */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <img src={eagleLogo} alt="Urus Jurista" width={80} height={80} className="mb-3" />
        <h1 className="font-display text-2xl tracking-[0.3em] text-foreground/80">
          URUS JURISTA
        </h1>
      </div>

      {/* Card */}
      <div className="relative z-10 flex w-full max-w-[750px] mx-4 rounded-2xl overflow-hidden border border-border/40 backdrop-blur-sm">
        {/* Left - Login */}
        <div className="flex-1 p-10 bg-card/60 backdrop-blur-md">
          <h2 className="font-display text-xl font-semibold text-foreground mb-1">Bem-vindo</h2>
          <p className="text-muted-foreground text-sm mb-8">Aceda à sua conta para continuar</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Endereço de E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="password"
              placeholder="Palavra-passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />

            <p className="text-right text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Esqueceu-se da palavra-passe?
            </p>

            <button
              type="submit"
              className="w-full py-3 rounded-lg text-sm font-semibold tracking-wide text-primary-foreground"
              style={{ background: "var(--gradient-button)" }}
            >
              Entrar no Sistema
            </button>
          </form>
        </div>

        {/* Right - Register CTA */}
        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-background/80 backdrop-blur-md">
          <h2 className="font-display text-2xl font-bold text-foreground mb-3">Primeira vez?</h2>
          <p className="text-muted-foreground text-sm text-center mb-8 max-w-[240px]">
            Crie uma conta gratuita hoje mesmo e descubra todas as possibilidades que temos para si.
          </p>
          <button className="px-8 py-2.5 rounded-full border border-foreground/50 text-foreground text-sm hover:bg-foreground/10 transition-colors">
            Registar-me
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
