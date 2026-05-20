import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ConstellationBackground from "@/components/ConstellationBackground";
import eagleLogo from "@/assets/eagle-logo.webp";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, CheckCircle2, Loader2, Send, Check, Clock, AlertTriangle } from "lucide-react";

type Mode = "request" | "update" | "done" | "error";

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
  const [searchParams] = useSearchParams();

  // Sanitiza ?next= para evitar open-redirect. Apenas paths internos válidos.
  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw) return null;
    if (!raw.startsWith("/")) return null;
    if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
    const low = raw.toLowerCase();
    if (low.startsWith("/login") || low.startsWith("/reset-password")) return null;
    return raw;
  }, [searchParams]);

  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  const recoveryRedirect = nextPath
    ? `${window.location.origin}/reset-password?next=${encodeURIComponent(nextPath)}`
    : `${window.location.origin}/reset-password`;

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
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendState, setResendState] = useState<"idle" | "sending" | "success">("idle");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [resendCount, setResendCount] = useState(0);
  const [nowTick, setNowTick] = useState(0);
  const [errorInfo, setErrorInfo] = useState<{ title: string; description: string } | null>(null);
  const [redirectIn, setRedirectIn] = useState(0);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRedirectTimers = () => {
    if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    if (redirectIntervalRef.current) clearInterval(redirectIntervalRef.current);
    redirectTimeoutRef.current = null;
    redirectIntervalRef.current = null;
  };

  useEffect(() => () => clearRedirectTimers(), []);

  const goToLoginNow = async () => {
    clearRedirectTimers();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[reset-password] signOut falhou no clique, prosseguindo", e);
    }
    navigate(loginHref, { replace: true });
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Tick a cada 30s para atualizar o "há X minutos"
  useEffect(() => {
    if (!lastSentAt) return;
    const t = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [lastSentAt]);

  const formatRelative = (date: Date) => {
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return "agora mesmo";
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `há ${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `há ${hrs}h`;
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const sendRecoveryEmail = async (targetEmail: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: recoveryRedirect,
    });
    return error;
  };

  const handleResend = async () => {
    if (!email.trim() || resendCooldown > 0 || resendState === "sending") return;
    setResendState("sending");
    const error = await sendRecoveryEmail(email.trim());
    if (error) {
      setResendState("idle");
      toast({ title: "Erro", description: friendlyError(error.message), variant: "destructive" });
      return;
    }
    setResendState("success");
    setLastSentAt(new Date());
    setResendCount((c) => c + 1);
    setResendCooldown(45);
    toast({ title: "✉️ Link reenviado", description: `Novo e-mail enviado para ${email}.` });
    setTimeout(() => setResendState("idle"), 2500);
  };

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
    setLastSentAt(new Date());
    setMode("done");
  };

  const finishAndRedirect = async (delayMs = 600) => {
    // Sempre limpa a sessão de recuperação (best-effort) e redireciona.
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[reset-password] signOut falhou, prosseguindo com redirect", e);
    }
    clearRedirectTimers();
    const seconds = Math.max(1, Math.ceil(delayMs / 1000));
    setRedirectIn(seconds);
    redirectIntervalRef.current = setInterval(() => {
      setRedirectIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    redirectTimeoutRef.current = setTimeout(() => {
      clearRedirectTimers();
      navigate("/login", { replace: true });
    }, delayMs);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validações locais — usuário pode corrigir sem perder a sessão de recuperação.
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas não coincidem", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const friendly = friendlyError(error.message);
        toast({
          title: "Não foi possível atualizar",
          description: `${friendly} Faça login novamente para tentar de novo.`,
          variant: "destructive",
        });
        setErrorInfo({
          title: "Não foi possível atualizar a senha",
          description: `${friendly} Por segurança, sua sessão de recuperação foi encerrada.`,
        });
        setMode("error");
        await finishAndRedirect(8000);
        return;
      }
      toast({ title: "✓ Senha atualizada", description: "Faça login com a nova senha." });
      await finishAndRedirect(800);
    } catch (err: any) {
      const friendly = friendlyError(err?.message);
      toast({
        title: "Erro inesperado",
        description: `${friendly} Redirecionando para o login…`,
        variant: "destructive",
      });
      setErrorInfo({
        title: "Erro inesperado",
        description: `${friendly} Você pode tentar novamente a partir da tela de login.`,
      });
      setMode("error");
      await finishAndRedirect(8000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-body bg-black bg-cover bg-center bg-no-repeat px-4"
      style={{ backgroundImage: "url('/login-bg.png')" }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
      <ConstellationBackground />

      <button
        onClick={() => navigate("/login", { replace: true })}
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
          ) : mode === "done" ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-300" />
              </div>
              <h2 className="font-display text-xl font-semibold text-white mb-2">Verifique seu e-mail</h2>
              <p className="text-white/50 text-sm mb-4">
                Enviamos um link de recuperação para <span className="text-white">{email}</span>. O link expira em 1 hora.
              </p>

              {lastSentAt && (
                <div
                  key={nowTick}
                  className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex items-center justify-center gap-2 text-[12px] text-white/60"
                >
                  <Clock size={13} className="text-white/40" />
                  <span>
                    Último envio: <span className="text-white/85 font-medium">{formatTime(lastSentAt)}</span>
                    <span className="text-white/40"> · {formatRelative(lastSentAt)}</span>
                  </span>
                  {resendCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/50 text-[10px] font-medium">
                      {resendCount}x reenviado
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleResend}
                  disabled={resendState === "sending" || resendCooldown > 0}
                  aria-live="polite"
                  className={`w-full py-3 rounded-xl text-sm font-bold tracking-wide disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2 ${
                    resendState === "success" ? "ring-1 ring-emerald-400/40" : ""
                  }`}
                  style={{
                    background:
                      resendState === "success"
                        ? "linear-gradient(135deg, hsl(152 60% 35%), hsl(160 65% 40%))"
                        : "var(--gradient-button)",
                    color: "white",
                  }}
                >
                  {resendState === "sending" ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Reenviando link…
                    </>
                  ) : resendState === "success" ? (
                    <>
                      <Check size={16} />
                      Link enviado!
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <Clock size={14} />
                      Aguarde {resendCooldown}s para reenviar
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Reenviar link
                    </>
                  )}
                </button>

                {resendCooldown > 0 && resendState !== "sending" && (
                  <div className="h-0.5 w-full bg-white/[0.06] rounded-full overflow-hidden -mt-1">
                    <div
                      className="h-full bg-white/40 transition-all duration-1000 ease-linear"
                      style={{ width: `${((45 - resendCooldown) / 45) * 100}%` }}
                    />
                  </div>
                )}

                <button
                  onClick={() => navigate("/login", { replace: true })}
                  className="px-6 py-2.5 rounded-2xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Voltar ao login
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4 ring-1 ring-red-400/30">
                <AlertTriangle size={26} className="text-red-300" />
              </div>
              <h2 className="font-display text-xl font-semibold text-white mb-2">
                {errorInfo?.title ?? "Algo deu errado"}
              </h2>
              <p className="text-white/55 text-sm mb-5">
                {errorInfo?.description ?? "Não foi possível concluir a operação."}
              </p>

              {redirectIn > 0 && (
                <div className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex items-center justify-center gap-2 text-[12px] text-white/55">
                  <Clock size={13} className="text-white/40" />
                  <span>
                    Redirecionando em <span className="text-white/85 font-medium">{redirectIn}s</span>…
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={goToLoginNow}
                  className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"
                  style={{ background: "var(--gradient-button)", color: "white" }}
                >
                  Ir para o login
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
