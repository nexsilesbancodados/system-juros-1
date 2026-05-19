import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ConstellationBackground from "@/components/ConstellationBackground";
import eagleLogo from "@/assets/eagle-logo.webp";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, CheckCircle2 } from "lucide-react";

type Mode = "request" | "update" | "done";

const inputCls =
  "w-full px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 transition-all duration-200";

const friendlyError = (msg?: string) => {
  if (!msg) return "Algo deu errado. Tente novamente.";
  const m = msg.toLowerCase();
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (m.includes("user not found") || m.includes("invalid")) return "E-mail não encontrado.";
  if (m.includes("expired") || m.includes("token")) return "Link expirado. Solicite um novo e-mail de recuperação.";
  if (m.includes("same as the old")) return "A nova senha deve ser diferente da atual.";
  if (m.includes("weak") || m.includes("at least")) return "Senha muito fraca. Use ao menos 6 caracteres.";
  return msg;
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config } = useWhiteLabel();
  const logoSrc = config.companyLogo || eagleLogo;
  const brandTitle = config.loginTitle || config.companyName || "SYSTEM JUROS";

  const [mode, setMode] = useState<Mode>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Detecta token de recuperação na URL (Supabase usa hash: #access_token=...&type=recovery)
  useEffect(() => {
    const hash = window.location.hash || "";
    const isRecovery = hash.includes("type=recovery") || hash.includes("access_token");

    if (isRecovery) {
      setMode("update");
      setChecking(false);
      return;
    }

    // onAuthStateChange capta PASSWORD_RECOVERY também
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    setChecking(false);
    return () => subscription.unsubscribe();
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Informe o e-mail", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: friendlyError(error.message), variant: "destructive" });
      return;
    }
    toast({
      title: "✉️ E-mail enviado",
      description: "Verifique sua caixa de entrada (e o spam) para redefinir a senha.",
    });
    setMode("done");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas não coincidem", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: friendlyError(error.message), variant: "destructive" });
      return;
    }
    toast({ title: "✓ Senha atualizada", description: "Faça login com a nova senha." });
    await supabase.auth.signOut();
    setTimeout(() => navigate("/login"), 800);
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-body bg-black bg-cover bg-center bg-no-repeat px-4"
      style={{ backgroundImage: "url('/login-bg.png')" }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
      <ConstellationBackground />

      <button
        onClick={() => navigate("/login")}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Voltar ao login</span>
      </button>

      <div className="relative z-10 flex flex-col items-center mb-8 animate-fade-in">
        <img src={logoSrc} alt={brandTitle} width={72} height={72} className="rounded-full ring-2 ring-white/20" />
        <h1 className="font-display text-xl tracking-[0.35em] mt-4 text-gradient-gold">{brandTitle}</h1>
      </div>

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl glass bg-white/[0.03] p-8">
          {checking ? (
            <p className="text-white/50 text-sm text-center">Carregando…</p>
          ) : mode === "request" ? (
            <>
              <h2 className="font-display text-xl font-semibold text-white mb-1">Recuperar senha</h2>
              <p className="text-white/40 text-sm mb-6">
                Informe seu e-mail e enviaremos um link para você definir uma nova senha.
              </p>
              <form onSubmit={handleRequest} className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">E-mail</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"
                  style={{ background: "var(--gradient-button)", color: "white" }}
                >
                  {loading ? "Enviando…" : <>Enviar link <ArrowRight size={16} /></>}
                </button>
              </form>
            </>
          ) : mode === "update" ? (
            <>
              <h2 className="font-display text-xl font-semibold text-white mb-1">Nova senha</h2>
              <p className="text-white/40 text-sm mb-6">Defina uma senha forte para sua conta.</p>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">Nova senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type={showPwd ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputCls} pl-10`}
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">Confirmar senha</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type={showPwd ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="Repita a nova senha"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-white/10"
                  style={{ background: "var(--gradient-button)", color: "white" }}
                >
                  {loading ? "Atualizando…" : "Atualizar senha"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-300" />
              </div>
              <h2 className="font-display text-xl font-semibold text-white mb-2">Verifique seu e-mail</h2>
              <p className="text-white/50 text-sm mb-6">
                Enviamos um link de recuperação para <span className="text-white">{email}</span>. O link expira em 1 hora.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="px-6 py-2.5 rounded-2xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition-all"
              >
                Voltar ao login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
