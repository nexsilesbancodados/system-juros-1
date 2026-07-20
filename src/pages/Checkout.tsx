import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { toast } from "sonner";

const FEATURES = [
  "Clientes e contratos ilimitados",
  "Agente de IA no WhatsApp",
  "Cálculo automático de multas e juros",
  "Portal do Cliente white-label",
  "Relatórios financeiros avançados",
  "Automações de cobrança",
  "App PWA (Android/iPhone)",
  "Suporte prioritário",
];

const PLAN_AMOUNT = 79.0;
const MP_SDK_SRC = "https://sdk.mercadopago.com/js/v2";
const MP_SECURITY_SRC = "https://www.mercadopago.com/v2/security.js";

declare global {
  interface Window {
    MercadoPago?: any;
    MP_DEVICE_SESSION_ID?: string;
  }
}

function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if ((existing as any)._loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}`)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = () => { (s as any)._loaded = true; resolve(); };
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(s);
  });
}

function loadMPSdk() { return loadScript(MP_SDK_SRC); }
function loadMPSecurity() {
  // security.js gera window.MP_DEVICE_SESSION_ID (device fingerprint)
  return loadScript(MP_SECURITY_SRC, { view: "checkout", output: "deviceId" });
}

export default function Checkout() {
  const navigate = useNavigate();
  const { config } = useWhiteLabel();
  const brand = config.companyName || "CredMais App";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<"CPF" | "CNPJ">("CPF");
  const [doc, setDoc] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [brickReady, setBrickReady] = useState(false);
  const [brickLoading, setBrickLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr: string; qrBase64: string } | null>(null);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const brickControllerRef = useRef<any>(null);
  const brickContainerId = "credmais-payment-brick";

  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const maskCPF = (v: string) => onlyDigits(v).slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  const maskCNPJ = (v: string) => onlyDigits(v).slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
  const maskPhone = (v: string) => {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  };
  const isValidCPF = (v: string) => {
    const c = onlyDigits(v);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    let s = 0; for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
    let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0; if (d1 !== parseInt(c[9])) return false;
    s = 0; for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
    let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0; return d2 === parseInt(c[10]);
  };
  const isValidCNPJ = (v: string) => {
    const c = onlyDigits(v);
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const calc = (base: string, weights: number[]) => {
      const s = weights.reduce((acc, w, i) => acc + parseInt(base[i]) * w, 0);
      const r = s % 11; return r < 2 ? 0 : 11 - r;
    };
    const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const d1 = calc(c.slice(0, 12), w1);
    const d2 = calc(c.slice(0, 12) + d1, w2);
    return d1 === parseInt(c[12]) && d2 === parseInt(c[13]);
  };
  const validDoc = docType === "CPF" ? isValidCPF(doc) : isValidCNPJ(doc);
  const validPhone = onlyDigits(whatsapp).length >= 10;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validName = name.trim().length >= 2;
  const canContinue = validName && validEmail && validDoc && validPhone;

  useEffect(() => {
    document.title = `Checkout — ${brand}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", `Assine o ${brand} com checkout seguro do Mercado Pago.`);
  }, [brand]);

  // Destroi brick ao desmontar
  useEffect(() => {
    return () => {
      try { brickControllerRef.current?.unmount?.(); } catch { /* noop */ }
    };
  }, []);

  const initBrick = async () => {
    if (!canContinue) {
      setFormError("Preencha nome, e-mail, CPF/CNPJ e WhatsApp corretamente");
      toast.error("Confira os dados antes de continuar");
      return;
    }
    setFormError(null);
    setBrickLoading(true);
    try {
      // 1) Busca a public key
      const { data: cfg, error: cfgErr } = await supabase.functions.invoke("mercadopago-config");
      if (cfgErr) throw cfgErr;
      const publicKey = (cfg as any)?.publicKey;
      if (!publicKey) throw new Error("Public key do Mercado Pago não configurada.");

      // 2) Carrega SDK v2 + security.js em paralelo (device fingerprint p/ maior aprovação)
      await Promise.all([loadMPSdk(), loadMPSecurity().catch(() => null)]);

      // 3) Inicializa Mercado Pago e renderiza Payment Brick
      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
      const bricksBuilder = mp.bricks();

      // limpa controlador anterior se houver
      try { brickControllerRef.current?.unmount?.(); } catch { /* noop */ }

      const [firstName, ...rest] = (name || "").trim().split(/\s+/);
      const lastName = rest.join(" ");

      const settings = {
        initialization: {
          amount: PLAN_AMOUNT,
          payer: {
            email,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
          },
        },
        customization: {
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
            bankTransfer: ["pix"],
            ticket: ["bolbradesco"],
            maxInstallments: 12,
          },
          visual: {
            style: {
              theme: "dark",
              customVariables: {
                baseColor: "#3b82f6",
                borderRadiusMedium: "12px",
                borderRadiusLarge: "16px",
                formInputsTextColor: "#ffffff",
                inputBackgroundColor: "rgba(255,255,255,0.05)",
                formBackgroundColor: "transparent",
              },
            },
          },
        },
        callbacks: {
          onReady: () => setBrickLoading(false),
          onError: (err: any) => {
            console.error("Brick error:", err);
            toast.error(err?.message || "Erro no formulário de pagamento");
          },
          onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
            try {
              const deviceId = window.MP_DEVICE_SESSION_ID;
              const { data, error } = await supabase.functions.invoke("mercadopago-process-payment", {
                body: { selectedPaymentMethod, formData, email, name, deviceId },
              });
              if (error) throw error;
              if ((data as any)?.error) throw new Error((data as any)?.message || "Pagamento recusado");
              const status = (data as any)?.status;
              const poi = (data as any)?.point_of_interaction?.transaction_data;
              const boleto = (data as any)?.transaction_details?.external_resource_url;

              if (selectedPaymentMethod === "pix" && poi?.qr_code) {
                setPixData({ qr: poi.qr_code, qrBase64: poi.qr_code_base64 });
                toast.success("Pix gerado! Escaneie ou copie o código.");
                return;
              }
              if ((selectedPaymentMethod === "ticket" || selectedPaymentMethod === "bolbradesco") && boleto) {
                setBoletoUrl(boleto);
                toast.success("Boleto gerado com sucesso!");
                return;
              }

              const paymentId = (data as any)?.id;
              const qs = paymentId ? `?id=${paymentId}&email=${encodeURIComponent(email)}` : "";
              if (status === "approved") {
                navigate(`/checkout/sucesso${qs}`);
              } else if (status === "in_process" || status === "pending") {
                navigate(`/checkout/pendente${qs}`);
              } else {
                navigate(`/checkout/erro${qs}`);
              }
            } catch (err: any) {
              console.error(err);
              toast.error(err?.message || "Falha ao processar pagamento");
              throw err;
            }
          },
        },
      };

      brickControllerRef.current = await bricksBuilder.create("payment", brickContainerId, settings);
      setBrickReady(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao carregar o checkout");
      setBrickLoading(false);
    }
  };

  const copyPix = async () => {
    if (!pixData) return;
    try {
      await navigator.clipboard.writeText(pixData.qr);
      toast.success("Código Pix copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione manualmente.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-blue-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-400/5 rounded-full blur-[120px]" />
      </div>

      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="text-sm font-bold tracking-wider text-white/80 hover:text-white flex items-center gap-2">
          <ArrowLeft size={16} /> {brand}
        </button>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Lock size={14} /> Checkout transparente · Mercado Pago
        </div>
      </header>

      <main className="container mx-auto px-6 pb-24 pt-6 grid lg:grid-cols-[1fr_1.15fr] gap-8 max-w-6xl">
        {/* Resumo */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-8 md:p-10 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-xl h-fit"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-6">
            <Sparkles size={12} /> Plano recomendado
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">Acesso Ilimitado</h1>
          <p className="text-white/50 leading-relaxed mb-8">Toda a plataforma {brand} liberada. Sem limites de clientes, contratos ou automações.</p>

          <div className="flex items-baseline gap-2 mb-8">
            <span className="text-white/40 text-lg">R$</span>
            <span className="text-6xl font-bold tracking-tight">79</span>
            <span className="text-white/40 text-lg">,00</span>
            <span className="text-white/40 text-sm ml-2">/mês</span>
          </div>

          <ul className="grid sm:grid-cols-2 gap-3 mb-8">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-white/80">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Check size={12} className="text-blue-300" />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4 pt-6 border-t border-white/10 text-xs text-white/50">
            <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-400" /> Criptografia SSL</div>
            <div className="flex items-center gap-2"><Lock size={14} className="text-blue-300" /> Cancele quando quiser</div>
          </div>
        </motion.section>

        {/* Formulário + Brick */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-8 md:p-10 rounded-[2rem] bg-white/[0.04] border border-white/10 backdrop-blur-xl"
        >
          <h2 className="text-xl font-bold mb-2">Pagamento seguro</h2>
          <p className="text-sm text-white/50 mb-8">Cartão, Pix ou Boleto — tudo processado sem sair do {brand}.</p>

          {/* Identificação */}
          {!brickReady && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2 block">Seu nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como você quer ser chamado"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60 focus:bg-white/[0.07] transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2 block">E-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/60 focus:bg-white/[0.07] transition-all"
                />
                <p className="text-[11px] text-white/40 mt-2">Após o pagamento você receberá um link mágico neste e-mail para acessar sua conta.</p>
              </div>

              <button
                type="button"
                onClick={initBrick}
                disabled={brickLoading}
                className="w-full py-4 rounded-2xl bg-white text-black font-bold text-base tracking-wide hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {brickLoading ? (<><Loader2 size={18} className="animate-spin" /> Carregando pagamento...</>) : ("Continuar para pagamento")}
              </button>
            </div>
          )}

          {/* Brick container */}
          <div className={brickReady ? "block" : "hidden"}>
            <div className="mb-4 flex items-center justify-between text-xs text-white/50">
              <span>Pagando como <strong className="text-white/80">{email}</strong></span>
              <button onClick={() => { brickControllerRef.current?.unmount?.(); setBrickReady(false); setPixData(null); setBoletoUrl(null); }} className="hover:text-white underline">alterar</button>
            </div>
            <div id={brickContainerId} className="min-h-[300px]" />
          </div>

          {/* Resultado Pix */}
          {pixData && (
            <div className="mt-8 p-6 rounded-2xl bg-emerald-500/5 border border-emerald-400/20">
              <div className="text-sm font-bold text-emerald-300 mb-3">Pague com Pix</div>
              {pixData.qrBase64 && (
                <img src={`data:image/png;base64,${pixData.qrBase64}`} alt="QR Code Pix" className="w-56 h-56 mx-auto rounded-xl bg-white p-2" />
              )}
              <button onClick={copyPix} className="w-full mt-4 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-all">
                Copiar código Pix
              </button>
              <p className="text-[11px] text-white/50 mt-3 text-center">A confirmação é automática. Assim que pago, você recebe o acesso por e-mail.</p>
            </div>
          )}

          {/* Resultado Boleto */}
          {boletoUrl && (
            <div className="mt-8 p-6 rounded-2xl bg-yellow-500/5 border border-yellow-400/20 text-center">
              <div className="text-sm font-bold text-yellow-300 mb-3">Boleto gerado</div>
              <a href={boletoUrl} target="_blank" rel="noreferrer" className="inline-block px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-all">
                Abrir boleto para pagamento
              </a>
              <p className="text-[11px] text-white/50 mt-3">Compensação em até 2 dias úteis. Você receberá o acesso por e-mail assim que confirmado.</p>
            </div>
          )}

          <p className="text-[11px] text-white/30 text-center leading-relaxed mt-8">
            Ao continuar você concorda com os <a href="/privacidade" className="underline hover:text-white/60">Termos e Política de Privacidade</a>.
          </p>
        </motion.section>
      </main>
    </div>
  );
}
