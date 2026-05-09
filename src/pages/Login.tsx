import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConstellationBackground from "@/components/ConstellationBackground";
import eagleLogo from "@/assets/eagle-logo.webp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config } = useWhiteLabel();
  const logoSrc = config.companyLogo || eagleLogo;
  const brandTitle = config.loginTitle || config.companyName || "SYSTEM JUROS";
  const brandSubtitle = config.loginSubtitle || "SISTEMA DE GESTÃO DE EMPRÉSTIMOS";
  const footerText = config.footerText || "© 2025 SYSTEM JUROS · TODOS OS DIREITOS RESERVADOS";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_expires_at, trial_ends_at")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const isSubscriptionActive = profile?.subscription_expires_at && new Date(profile.subscription_expires_at).getTime() > Date.now();
      const isTrialActive = profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now();

      if (!isSubscriptionActive && !isTrialActive) {
        const { data: settings } = await supabase.from("settings").select("hubla_checkout_url").single();
        if (settings?.hubla_checkout_url) {
          toast({ title: "Acesso pendente", description: "Sua assinatura expirou. Redirecionando para o checkout..." });
          setTimeout(() => {
            window.location.href = settings.hubla_checkout_url;
          }, 2000);
          return;
        }
      }
      
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
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao registar", description: error.message, variant: "destructive" });
    } else {
      toast({ 
        title: "Conta criada!", 
        description: "Verifique seu e-mail para confirmar o cadastro e ativar sua conta." 
      });
      
      const { data: settings } = await supabase.from("settings").select("hubla_checkout_url").maybeSingle();
      if (settings?.hubla_checkout_url) {
        toast({ title: "Quase lá!", description: "Redirecionando para ativação da conta..." });
        setTimeout(() => {
          window.location.href = settings.hubla_checkout_url;
        }, 3000);
      }

      supabase.functions.invoke('send-welcome-email', {
        body: { email, name }
      }).catch(err => console.error('Error sending welcome email:', err));

      setIsRegister(false);
    }
  };

  const inputCls = "w-full px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 transition-all duration-200";

  return (
    <div 
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-body bg-black bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/login-bg.png')" }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
      <ConstellationBackground />

      <button 
        onClick={() => navigate("/")}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Voltar para o site</span>
      </button>

      {/* Logo & Title */}
      <div className="relative z-10 flex flex-col items-center mb-10 animate-fade-in">
        <div className="relative w-[120px] h-[120px] flex items-center justify-center">
          <div className="absolute inset-2 rounded-full gold-glow" />
          <div className="absolute inset-0 rounded-full pointer-events-none">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[hsl(45,90%,60%)] shadow-[0_0_12px_hsl(45,90%,60%)]" />
          </div>
          <img
            src={logoSrc}
            alt={brandTitle}
            width={88}
            height={88}
            className="relative rounded-full ring-2 ring-white/20"
          />
        </div>
        <h1 className="font-display text-2xl tracking-[0.35em] mt-4 text-gradient-gold">
          {brandTitle}
        </h1>
        <p className="text-white/40 text-xs mt-1.5 tracking-wider">{brandSubtitle}</p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[800px] mx-4 lg:ml-[15%] lg:mr-auto animate-scale-in">
        <div className="rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl">
          {!isRegister ? (
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 p-8 md:p-10 glass bg-white/[0.03]">
                <h2 className="font-display text-xl font-semibold text-white mb-1">Bem-vindo</h2>
                <p className="text-white/40 text-sm mb-8">Acesse sua conta para continuar</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">E-mail</label>
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">Senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={inputCls}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <p className="text-right text-xs text-white/30 cursor-pointer hover:text-white/70 transition-colors">
                    Esqueceu a senha?
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50 transition-all duration-300 hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"
                    style={{ background: "var(--gradient-button)", color: "white" }}
                  >
                    {loading ? "Entrando..." : <>Entrar no Sistema <ArrowRight size={16} /></>}
                  </button>
                </form>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-10 glass bg-white/[0.02] border-t md:border-t-0 md:border-l border-white/[0.06]">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-5">
                  <ArrowRight size={28} className="text-white/70" />
                </div>
                <h2 className="font-display text-xl font-bold text-white mb-2">Primeira vez?</h2>
                <p className="text-white/40 text-sm text-center mb-6 max-w-[240px]">
                  Crie uma conta gratuita e descubra todas as possibilidades.
                </p>
                <button
                  onClick={() => setIsRegister(true)}
                  className="px-8 py-2.5 rounded-2xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition-all duration-300"
                >
                  Criar Conta
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-10 glass bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/[0.06]">
                <h2 className="font-display text-xl font-bold text-white mb-2">Já tem conta?</h2>
                <p className="text-white/40 text-sm text-center mb-6 max-w-[240px]">
                  Entre com suas credenciais e acesse o sistema.
                </p>
                <button
                  onClick={() => setIsRegister(false)}
                  className="px-8 py-2.5 rounded-2xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition-all duration-300"
                >
                  Fazer Login
                </button>
              </div>

              <div className="flex-1 p-8 md:p-10 glass bg-white/[0.03]">
                <h2 className="font-display text-xl font-semibold text-white mb-1">Criar Conta</h2>
                <p className="text-white/40 text-sm mb-8">Preencha os dados para se registar</p>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">Nome</label>
                    <input type="text" placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">E-mail</label>
                    <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">Senha</label>
                    <input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputCls} />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50 transition-all duration-300 hover:shadow-lg hover:shadow-white/10"
                    style={{ background: "var(--gradient-button)", color: "white" }}
                  >
                    {loading ? "Criando conta..." : "Criar Conta"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-white/20 text-[10px] mt-8 tracking-wider">
        {footerText}
      </p>
    </div>
  );
};

export default Login;
