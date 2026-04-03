import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConstellationBackground from "@/components/ConstellationBackground";
import eagleLogo from "@/assets/eagle-logo.webp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao registar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o cadastro." });
      setIsRegister(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-body">
      <ConstellationBackground />

      {/* Logo & Title */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <img src={eagleLogo} alt="Urus Jurista" width={80} height={80} className="mb-3 rounded-full" />
        <h1 className="font-display text-2xl tracking-[0.3em] text-foreground/80">
          URUS JURISTA
        </h1>
      </div>

      {/* Card */}
      <div className="relative z-10 flex w-full max-w-[750px] mx-4 rounded-2xl overflow-hidden border border-border/40 backdrop-blur-sm">
        {!isRegister ? (
          <>
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
                  required
                  className="w-full px-4 py-3 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="password"
                  placeholder="Palavra-passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <p className="text-right text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Esqueceu-se da palavra-passe?
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg text-sm font-semibold tracking-wide text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--gradient-button)" }}
                >
                  {loading ? "Entrando..." : "Entrar no Sistema"}
                </button>
              </form>
            </div>

            {/* Right - Register CTA */}
            <div className="flex-1 flex flex-col items-center justify-center p-10 bg-background/80 backdrop-blur-md">
              <h2 className="font-display text-2xl font-bold text-foreground mb-3">Primeira vez?</h2>
              <p className="text-muted-foreground text-sm text-center mb-8 max-w-[240px]">
                Crie uma conta gratuita hoje mesmo e descubra todas as possibilidades que temos para si.
              </p>
              <button
                onClick={() => setIsRegister(true)}
                className="px-8 py-2.5 rounded-full border border-foreground/50 text-foreground text-sm hover:bg-foreground/10 transition-colors"
              >
                Registar-me
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Left - Back to Login CTA */}
            <div className="flex-1 flex flex-col items-center justify-center p-10 bg-background/80 backdrop-blur-md">
              <h2 className="font-display text-2xl font-bold text-foreground mb-3">Já tem conta?</h2>
              <p className="text-muted-foreground text-sm text-center mb-8 max-w-[240px]">
                Entre com as suas credenciais e aceda ao sistema.
              </p>
              <button
                onClick={() => setIsRegister(false)}
                className="px-8 py-2.5 rounded-full border border-foreground/50 text-foreground text-sm hover:bg-foreground/10 transition-colors"
              >
                Entrar
              </button>
            </div>

            {/* Right - Register Form */}
            <div className="flex-1 p-10 bg-card/60 backdrop-blur-md">
              <h2 className="font-display text-xl font-semibold text-foreground mb-1">Criar Conta</h2>
              <p className="text-muted-foreground text-sm mb-8">Preencha os dados para se registar</p>

              <form onSubmit={handleRegister} className="space-y-4">
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="email"
                  placeholder="Endereço de E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="password"
                  placeholder="Palavra-passe (mín. 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg text-sm font-semibold tracking-wide text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--gradient-button)" }}
                >
                  {loading ? "Criando conta..." : "Criar Conta"}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
