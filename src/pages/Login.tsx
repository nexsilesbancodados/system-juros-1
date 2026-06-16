import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import ConstellationBackground from "@/components/ConstellationBackground";
import eagleLogo from "@/assets/eagle-logo.webp";
import { supabase } from "@/integrations/supabase/client";
import { setRememberMe, getRememberMe } from "@/integrations/supabase/remember";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";

// ---------- Validação ----------
const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail")
  .email("E-mail inválido")
  .max(255, "E-mail muito longo");

const passwordLoginSchema = z
  .string()
  .min(1, "Informe sua senha")
  .max(72, "Senha muito longa");

const passwordRegisterSchema = z
  .string()
  .min(6, "Use no mínimo 6 caracteres")
  .max(72, "Senha muito longa");

const nameSchema = z
  .string()
  .trim()
  .min(2, "Informe seu nome (mín. 2 caracteres)")
  .max(80, "Nome muito longo");

// ---------- Tradução de erros do Supabase ----------
const friendlyAuthError = (err: any): string => {
  const msg = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  if (code.includes("invalid_credentials") || msg.includes("invalid login"))
    return "E-mail ou senha incorretos.";
  if (msg.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("user already"))
    return "Este e-mail já está cadastrado. Faça login.";
  if (msg.includes("rate limit") || err?.status === 429)
    return "Muitas tentativas. Aguarde alguns minutos.";
  if (msg.includes("weak password"))
    return "Senha fraca. Use letras e números.";
  if (msg.includes("network") || msg.includes("failed to fetch"))
    return "Sem conexão. Verifique sua internet.";
  return err?.message || "Não foi possível concluir. Tente novamente.";
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan");
  const [isRegister, setIsRegister] = useState(!!planParam);
  const [selectedPlan, setSelectedPlan] = useState<"trial" | "paid" | null>(
    planParam === "paid" ? "paid" : planParam === "trial" ? "trial" : null,
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMeState] = useState<boolean>(() => getRememberMe());
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string; plan?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; name?: boolean }>({});
  const navigate = useNavigate();

  const sanitizeNext = (raw: string | null): string | null => {
    if (!raw) return null;
    if (!raw.startsWith("/")) return null;
    if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
    if (raw.toLowerCase().startsWith("/login") || raw.toLowerCase().startsWith("/reset-password")) return null;
    return raw;
  };
  const nextPath = sanitizeNext(searchParams.get("next"));
  const { toast } = useToast();
  const { config } = useWhiteLabel();
  const logoSrc = config.companyLogo || eagleLogo;
  const brandTitle = config.loginTitle || config.companyName || "SYSTEM JUROS";
  const brandSubtitle = config.loginSubtitle || "SISTEMA DE GESTÃO DE EMPRÉSTIMOS";
  const footerText = config.footerText || "© 2025 SYSTEM JUROS · TODOS OS DIREITOS RESERVADOS";

  // Força da senha (apenas no registro)
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  }, [password]);
  const strengthLabel = ["", "Fraca", "Razoável", "Boa", "Forte"][passwordStrength];
  const strengthColor = [
    "bg-white/10",
    "bg-red-400/80",
    "bg-amber-400/80",
    "bg-yellow-300/80",
    "bg-emerald-400/80",
  ][passwordStrength];

  const validateField = (field: "email" | "password" | "name", value: string) => {
    try {
      if (field === "email") emailSchema.parse(value);
      if (field === "password") (isRegister ? passwordRegisterSchema : passwordLoginSchema).parse(value);
      if (field === "name") nameSchema.parse(value);
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [field]: err.errors[0]?.message }));
      }
    }
  };

  const validateAll = (mode: "login" | "register"): boolean => {
    const next: typeof errors = {};
    const eRes = emailSchema.safeParse(email);
    if (!eRes.success) next.email = eRes.error.errors[0]?.message;
    if (mode === "login") {
      const pRes = passwordLoginSchema.safeParse(password);
      if (!pRes.success) next.password = pRes.error.errors[0]?.message;
    }
    if (mode === "register") {
      const nRes = nameSchema.safeParse(name);
      if (!nRes.success) next.name = nRes.error.errors[0]?.message;
      // No password / plan validation: account is created after payment confirmation.
    }
    setErrors(next);
    setTouched({ email: true, password: mode === "login", name: mode === "register" });
    return Object.keys(next).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validateAll("login")) return;
    setLoading(true);
    setRememberMe(rememberMe);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      const msg = friendlyAuthError(error);
      setFormError(msg);
      toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_expires_at, trial_ends_at")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    const isSubscriptionActive =
      profile?.subscription_expires_at && new Date(profile.subscription_expires_at).getTime() > Date.now();
    const isTrialActive =
      profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now();

    if (!isSubscriptionActive && !isTrialActive) {
      const { data: checkoutUrl } = await supabase.rpc("get_signup_checkout_url");
      if (checkoutUrl) {
        toast({ title: "Acesso pendente", description: "Sua assinatura expirou. Redirecionando para o checkout..." });
        setTimeout(() => {
          window.location.href = checkoutUrl as string;
        }, 1500);
        return;
      }
    }
    setLoading(false);
    navigate(nextPath ?? "/dashboard", { replace: true });
  };

  // NEW FLOW: don't create the auth user here. Send the visitor straight to checkout.
  // The Hubla webhook will create the account (invite email) only after a confirmed payment.
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validateAll("register")) return;
    setLoading(true);

    try {
      const { data: checkoutUrl } = await supabase.rpc("get_signup_checkout_url");
      if (!checkoutUrl) {
        setLoading(false);
        const msg = "Nenhum link de pagamento configurado. Entre em contato com o suporte.";
        setFormError(msg);
        toast({ title: "Indisponível", description: msg, variant: "destructive" });
        return;
      }

      // Pass email + name to the checkout so Hubla can pre-fill and link the payer.
      let url = String(checkoutUrl);
      try {
        const u = new URL(url);
        u.searchParams.set("email", email.trim());
        if (name.trim()) u.searchParams.set("name", name.trim());
        url = u.toString();
      } catch {
        // checkout URL might be a non-standard string — fall back to raw URL
      }

      toast({
        title: "Redirecionando para o pagamento 💳",
        description: "Após a confirmação, você receberá um e-mail para criar sua senha e acessar o sistema.",
      });
      setTimeout(() => {
        window.location.href = url;
      }, 1200);
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || "Não foi possível abrir o checkout. Tente novamente.";
      setFormError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  // ---------- Estilos ----------
  const inputBase =
    "w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.04] border text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 transition-all duration-200";
  const inputOk = "border-white/[0.08] focus:ring-white/30 focus:border-white/30";
  const inputErr = "border-red-400/40 focus:ring-red-400/40 focus:border-red-400/60";
  const cls = (field: "email" | "password" | "name") =>
    `${inputBase} ${touched[field] && errors[field] ? inputErr : inputOk}`;

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? (
      <p className="mt-1.5 text-[11px] text-red-300/90 flex items-center gap-1.5 animate-fade-in">
        <AlertCircle size={12} className="shrink-0" />
        <span>{msg}</span>
      </p>
    ) : null;

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-body bg-black bg-cover bg-center bg-no-repeat px-4"
      style={{ backgroundImage: "url('/login-bg.png')" }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
      <ConstellationBackground />

      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 md:top-8 md:left-8 z-20 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium hidden sm:inline">Voltar para o site</span>
      </button>

      {/* Logo & Título */}
      <div className="relative z-10 flex flex-col items-center mb-8 md:mb-10 animate-fade-in">
        <div className="relative w-[110px] h-[110px] md:w-[120px] md:h-[120px] flex items-center justify-center">
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
        <h1 className="font-display text-xl md:text-2xl tracking-[0.3em] md:tracking-[0.35em] mt-4 text-gradient-gold text-center">
          {brandTitle}
        </h1>
        <p className="text-white/40 text-[10px] md:text-xs mt-1.5 tracking-wider text-center">{brandSubtitle}</p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[820px] mx-auto animate-scale-in">
        <div className="rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl">
          {!isRegister ? (
            <div className="flex flex-col md:flex-row">
              {/* Form de Login */}
              <div className="flex-1 p-7 md:p-10 glass bg-white/[0.03]">
                <h2 className="font-display text-xl font-semibold text-white mb-1">Bem-vindo</h2>
                <p className="text-white/40 text-sm mb-6">Acesse sua conta para continuar</p>

                {formError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-xl border border-red-400/30 bg-red-500/10 text-red-100 text-xs flex items-start gap-2 animate-fade-in"
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="login-email" className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (touched.email) validateField("email", e.target.value);
                        }}
                        onBlur={() => {
                          setTouched((t) => ({ ...t, email: true }));
                          validateField("email", email);
                        }}
                        aria-invalid={!!(touched.email && errors.email)}
                        aria-describedby={errors.email ? "login-email-err" : undefined}
                        className={cls("email")}
                      />
                    </div>
                    <div id="login-email-err"><FieldError msg={touched.email ? errors.email : undefined} /></div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (touched.password) validateField("password", e.target.value);
                        }}
                        onBlur={() => {
                          setTouched((t) => ({ ...t, password: true }));
                          validateField("password", password);
                        }}
                        aria-invalid={!!(touched.password && errors.password)}
                        aria-describedby={errors.password ? "login-pwd-err" : undefined}
                        className={cls("password") + " pr-11"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div id="login-pwd-err"><FieldError msg={touched.password ? errors.password : undefined} /></div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <span className="relative inline-flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMeState(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="w-4 h-4 rounded-[5px] border border-white/20 bg-white/[0.04] peer-checked:bg-white/90 peer-checked:border-white/90 transition-all duration-200" />
                        <svg
                          viewBox="0 0 16 16"
                          className="absolute w-3 h-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 8.5l3.5 3.5L13 5" />
                        </svg>
                      </span>
                      <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                        Lembrar-me
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(nextPath ? `/reset-password?next=${encodeURIComponent(nextPath)}` : "/reset-password")
                      }
                      className="text-xs text-white/40 hover:text-white/80 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>


                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"
                    style={{ background: "var(--gradient-button)", color: "white" }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Entrando...
                      </>
                    ) : (
                      <>
                        Entrar no Sistema <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>


              </div>

              {/* Painel direito */}
              <div className="flex-1 flex flex-col items-center justify-center p-7 md:p-10 glass bg-white/[0.02] border-t md:border-t-0 md:border-l border-white/[0.06]">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-5">
                  <ArrowRight size={28} className="text-white/70" />
                </div>
                <h2 className="font-display text-xl font-bold text-white mb-2">Primeira vez?</h2>
                <p className="text-white/40 text-sm text-center mb-6 max-w-[260px]">
                  Crie uma conta gratuita e descubra todas as possibilidades.
                </p>
                <button
                  onClick={() => {
                    setIsRegister(true);
                    setErrors({});
                    setFormError(null);
                    setTouched({});
                  }}
                  className="px-8 py-2.5 rounded-2xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition-all duration-300"
                >
                  Criar Conta
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 flex flex-col items-center justify-center p-7 md:p-10 glass bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/[0.06]">
                <h2 className="font-display text-xl font-bold text-white mb-2">Já tem conta?</h2>
                <p className="text-white/40 text-sm text-center mb-6 max-w-[260px]">
                  Entre com suas credenciais e acesse o sistema.
                </p>
                <button
                  onClick={() => {
                    setIsRegister(false);
                    setErrors({});
                    setFormError(null);
                    setTouched({});
                  }}
                  className="px-8 py-2.5 rounded-2xl border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 transition-all duration-300"
                >
                  Fazer Login
                </button>
              </div>

              <div className="flex-1 p-7 md:p-10 glass bg-white/[0.03]">
                <h2 className="font-display text-xl font-semibold text-white mb-1">Assinar &amp; criar conta</h2>
                <p className="text-white/40 text-sm mb-4">
                  Pague primeiro com segurança. Sua conta é criada automaticamente após a confirmação — você recebe um e-mail para definir a senha.
                </p>

                <div className="mb-5 p-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] text-[11px] text-amber-100/80 leading-relaxed">
                  <strong className="text-amber-200">Como funciona:</strong> preencha nome e e-mail →
                  é redirecionado para o pagamento (Hubla) → recebe e-mail de boas-vindas com link para entrar.
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-xl border border-red-400/30 bg-red-500/10 text-red-100 text-xs flex items-start gap-2 animate-fade-in"
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="reg-name" className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">
                      Nome
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        id="reg-name"
                        type="text"
                        autoComplete="name"
                        placeholder="Nome completo"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (touched.name) validateField("name", e.target.value);
                        }}
                        onBlur={() => {
                          setTouched((t) => ({ ...t, name: true }));
                          validateField("name", name);
                        }}
                        aria-invalid={!!(touched.name && errors.name)}
                        className={cls("name")}
                      />
                    </div>
                    <FieldError msg={touched.name ? errors.name : undefined} />
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5 block">
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (touched.email) validateField("email", e.target.value);
                        }}
                        onBlur={() => {
                          setTouched((t) => ({ ...t, email: true }));
                          validateField("email", email);
                        }}
                        aria-invalid={!!(touched.email && errors.email)}
                        className={cls("email")}
                      />
                    </div>
                    <FieldError msg={touched.email ? errors.email : undefined} />
                    <p className="mt-1.5 text-[10px] text-white/40">
                      Use o mesmo e-mail no checkout para que sua assinatura seja vinculada à sua conta.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"
                    style={{ background: "var(--gradient-button)", color: "white" }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Abrindo checkout...
                      </>
                    ) : (
                      <>
                        Ir para o pagamento <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-white/30 text-center leading-relaxed">
                    Pagamento processado de forma segura pelo Hubla. Sem fidelidade — cancele quando quiser.
                  </p>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="relative z-10 text-white/20 text-[10px] mt-8 tracking-wider text-center px-4">
        {footerText}
      </p>
    </div>
  );
};

export default Login;
