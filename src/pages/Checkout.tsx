import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { toast } from "sonner";

const FEATURES: { title: string; desc: string }[] = [
  { title: "Clientes e contratos ilimitados", desc: "Sem tetos por plano, escale sua carteira sem custo extra." },
  { title: "Agente de IA no WhatsApp", desc: "Cobrança automática 24/7 com respostas humanizadas." },
  { title: "Cálculo automático de multas e juros", desc: "Regras aplicadas todo dia sem trabalho manual." },
  { title: "Portal do Cliente white-label", desc: "Área do cliente com sua marca, sem menção externa." },
  { title: "Relatórios financeiros avançados", desc: "Lucro gerado, fluxo, inadimplência em tempo real." },
  { title: "Suporte prioritário", desc: "Time dedicado por WhatsApp em horário comercial." },
];

const PLAN_AMOUNT = 99.9;
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
    // Inject Outfit + Figtree fonts for this page
    const linkId = "credmais-checkout-fonts";
    if (!document.getElementById(linkId)) {
      const l = document.createElement("link");
      l.id = linkId;
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(l);
    }
  }, [brand]);

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
      const { data: cfg, error: cfgErr } = await supabase.functions.invoke("mercadopago-config");
      if (cfgErr) throw cfgErr;
      const publicKey = (cfg as any)?.publicKey;
      if (!publicKey) throw new Error("Public key do Mercado Pago não configurada.");

      await Promise.all([loadMPSdk(), loadMPSecurity().catch(() => null)]);

      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
      const bricksBuilder = mp.bricks();

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
            identification: {
              type: docType,
              number: onlyDigits(doc),
            },
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
              theme: "default",
              customVariables: {
                baseColor: "#0d7a5f",
                borderRadiusMedium: "12px",
                borderRadiusLarge: "16px",
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
                body: { selectedPaymentMethod, formData, email, name, deviceId, docType, doc: onlyDigits(doc), whatsapp: onlyDigits(whatsapp) },
              });
              if (error) throw error;
              if ((data as any)?.error) throw new Error((data as any)?.message || "Pagamento recusado");
              const status = (data as any)?.status;
              const pmId = (data as any)?.payment_method_id;
              const poi = (data as any)?.point_of_interaction?.transaction_data;
              const boleto = (data as any)?.transaction_details?.external_resource_url;

              if ((pmId === "pix" || selectedPaymentMethod === "pix" || selectedPaymentMethod === "bank_transfer") && poi?.qr_code) {
                setPixData({ qr: poi.qr_code, qrBase64: poi.qr_code_base64 });
                toast.success("Pix gerado! Escaneie ou copie o código.");
                return;
              }
              if ((pmId === "bolbradesco" || selectedPaymentMethod === "ticket" || selectedPaymentMethod === "bolbradesco") && boleto) {
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

  // Local design tokens (Emerald Prestige) — scoped to this checkout page
  const c = {
    bg: "#f5f0e0",
    ink: "#064e3b",
    inkSoft: "#0d7a5f",
    gold: "#c9a84c",
    goldSoft: "#f0d78c",
    cream: "#f5f0e0",
  };

  const heading: React.CSSProperties = { fontFamily: "'Outfit', system-ui, sans-serif" };
  const body: React.CSSProperties = { fontFamily: "'Figtree', system-ui, sans-serif" };

  const inputBase =
    "w-full px-4 py-3 bg-white border rounded-xl outline-none transition-all text-[#064e3b] placeholder:text-gray-400 focus:ring-2 focus:ring-[#c9a84c]/30";

  return (
    <div className="min-h-screen w-full flex items-start justify-center py-6 px-4 md:px-8" style={{ backgroundColor: c.bg, ...body }}>
      <div className="w-full max-w-6xl">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 text-xs" style={{ color: c.ink }}>
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 font-semibold hover:opacity-70 transition-opacity">
            <ArrowLeft size={14} /> Voltar
          </button>
          <div className="inline-flex items-center gap-2 opacity-70">
            <Lock size={13} /> Checkout transparente · Mercado Pago
          </div>
        </div>

        {/* Banner Premium */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full mb-6 rounded-3xl overflow-hidden shadow-[0_20px_50px_-20px_rgba(6,78,59,0.35)]"
          style={{ background: `linear-gradient(115deg, ${c.ink} 0%, ${c.inkSoft} 55%, ${c.ink} 100%)` }}
        >
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full opacity-30 blur-3xl" style={{ backgroundColor: c.gold }} />
          <div className="pointer-events-none absolute -bottom-32 -right-10 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: c.goldSoft }} />
          {/* Grid pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
              backgroundSize: "42px 42px",
            }}
          />

          <div className="relative z-10 px-6 md:px-12 py-8 md:py-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <div className="flex-1">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] mb-4"
                style={{ backgroundColor: `${c.gold}25`, color: c.goldSoft, border: `1px solid ${c.gold}55` }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: c.gold }} />
                Oferta de Lançamento · Vagas Limitadas
              </div>
              <h1
                className="text-2xl md:text-4xl font-bold leading-tight text-white mb-2"
                style={heading}
              >
                Automatize sua carteira e{" "}
                <span style={{ color: c.goldSoft }}>multiplique seus lucros</span>
              </h1>
              <p className="text-sm md:text-base max-w-xl" style={{ color: `${c.cream}cc` }}>
                Cobrança inteligente 24/7, cálculo automático de juros e portal white-label — tudo em um só sistema.
              </p>
            </div>

            <div className="flex items-center gap-4 md:gap-6 md:pl-8 md:border-l" style={{ borderColor: `${c.goldSoft}33` }}>
              <div className="flex flex-col items-center">
                <ShieldCheck size={22} style={{ color: c.goldSoft }} />
                <span className="mt-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: c.cream }}>Seguro</span>
              </div>
              <div className="flex flex-col items-center">
                <Lock size={22} style={{ color: c.goldSoft }} />
                <span className="mt-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: c.cream }}>SSL 256</span>
              </div>
              <div className="flex flex-col items-center">
                <Check size={22} style={{ color: c.goldSoft }} />
                <span className="mt-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: c.cream }}>Mercado Pago</span>
              </div>
            </div>
          </div>
        </motion.div>


        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(6,78,59,0.18)] flex flex-col md:flex-row"
        >
          {/* Left — Plan summary */}
          <aside
            className="w-full md:w-5/12 p-8 md:p-12 flex flex-col relative overflow-hidden"
            style={{ backgroundColor: c.ink, color: c.cream }}
          >
            <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: c.inkSoft }} />

            <div className="relative z-10 mb-10">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: c.gold }}>
                  <div className="w-4 h-4 border-2 rotate-45" style={{ borderColor: c.ink }} />
                </div>
                <span className="text-2xl font-bold tracking-tight text-white" style={heading}>{brand}</span>
              </div>

              <p className="font-semibold uppercase tracking-widest text-[11px] mb-2" style={{ color: c.inkSoft }}>Você está assinando</p>
              <h1 className="text-4xl font-bold text-white mb-5" style={heading}>Acesso Ilimitado</h1>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-medium opacity-80">R$</span>
                <span className="text-5xl font-bold" style={{ ...heading, color: c.gold }}>99,90</span>
                <span className="text-lg font-medium opacity-80">/mês</span>
              </div>
              <p className="text-sm mt-3 leading-relaxed" style={{ color: c.inkSoft }}>
                Cobrança recorrente mensal · Cancele quando quiser
              </p>
            </div>

            <div className="relative z-10 space-y-5 flex-grow">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4 items-start">
                  <div className="mt-1 shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: c.inkSoft }}>
                    <Check size={12} strokeWidth={3} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-[15px]">{f.title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: c.inkSoft }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative z-10 mt-10 pt-6 border-t flex items-center justify-between text-[11px]" style={{ borderColor: `${c.inkSoft}55`, color: c.inkSoft }}>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Criptografia SSL</span>
              <span className="italic">Processado por Mercado Pago</span>
            </div>
          </aside>

          {/* Right — Form + Brick */}
          <main className="w-full md:w-7/12 p-8 md:p-12 overflow-y-auto">
            {!brickReady && (
              <>
                <header className="mb-8">
                  <div className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: c.inkSoft }}>
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px]" style={{ backgroundColor: c.ink }}>1</span>
                    Etapa 1 de 2
                  </div>
                  <h2 className="text-2xl font-bold" style={{ ...heading, color: c.ink }}>Identificação</h2>
                  <p className="text-sm text-gray-500 mt-1">Preencha seus dados para liberar o formulário de pagamento.</p>
                </header>

                <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); initBrick(); }}>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: c.ink }}>Nome completo *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como no seu documento"
                      className={`${inputBase} border-gray-200 focus:border-[#0d7a5f]`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: c.ink }}>E-mail *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@empresa.com"
                        className={`${inputBase} border-gray-200 focus:border-[#0d7a5f]`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: c.ink }}>WhatsApp *</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className={`${inputBase} ${whatsapp && !validPhone ? "border-red-400" : "border-gray-200 focus:border-[#0d7a5f]"}`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: c.ink }}>Documento *</label>
                      <div className="flex bg-gray-100 p-1 rounded-lg">
                        {(["CPF", "CNPJ"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setDocType(t); setDoc(""); }}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                              docType === t ? "bg-white shadow-sm" : "text-gray-400"
                            }`}
                            style={docType === t ? { color: c.ink } : undefined}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      inputMode="numeric"
                      value={doc}
                      onChange={(e) => setDoc(docType === "CPF" ? maskCPF(e.target.value) : maskCNPJ(e.target.value))}
                      placeholder={docType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                      className={`${inputBase} ${doc && !validDoc ? "border-red-400" : "border-gray-200 focus:border-[#0d7a5f]"}`}
                    />
                    {doc && !validDoc && (
                      <p className="text-[11px] text-red-500 mt-2">{docType} inválido</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-dashed p-4 text-[12px] text-gray-500 leading-relaxed" style={{ borderColor: "#e5e0d0", backgroundColor: "#fbf8ee" }}>
                    Após a confirmação do pagamento você receberá um link mágico em <strong style={{ color: c.ink }}>{email || "seu e-mail"}</strong> para acessar a conta imediatamente.
                  </div>

                  {formError && <p className="text-xs text-red-500">{formError}</p>}

                  <button
                    type="submit"
                    disabled={brickLoading || !canContinue}
                    className="w-full py-4 rounded-xl font-bold text-[15px] transition-all shadow-[0_8px_20px_-4px_rgba(201,168,76,0.5)] hover:brightness-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    style={{ ...heading, backgroundColor: c.gold, color: c.ink }}
                  >
                    {brickLoading ? (
                      <><Loader2 size={18} className="animate-spin" /> Carregando pagamento...</>
                    ) : (
                      <>Continuar para pagamento <ArrowRight size={18} strokeWidth={2.5} /></>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-gray-400 pt-1">
                    Ao continuar você concorda com nossos{" "}
                    <a href="/privacidade" className="underline hover:text-[#064e3b]">Termos e Política de Privacidade</a>.
                  </p>
                </form>
              </>
            )}

            {brickReady && (
              <>
                <header className="mb-8">
                  <div className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: c.inkSoft }}>
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px]" style={{ backgroundColor: c.gold, color: c.ink }}>2</span>
                    Etapa 2 de 2
                  </div>
                  <h2 className="text-2xl font-bold" style={{ ...heading, color: c.ink }}>Forma de Pagamento</h2>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Pagando como <strong style={{ color: c.ink }}>{email}</strong></span>
                    <button
                      onClick={() => { brickControllerRef.current?.unmount?.(); setBrickReady(false); setPixData(null); setBoletoUrl(null); }}
                      className="underline hover:text-[#064e3b]"
                    >
                      alterar
                    </button>
                  </div>
                </header>

                <div id={brickContainerId} className="min-h-[300px] rounded-2xl" />

                {pixData && (
                  <div className="mt-8 p-6 rounded-2xl border" style={{ borderColor: `${c.inkSoft}33`, backgroundColor: "#f0faf5" }}>
                    <div className="text-sm font-bold mb-3" style={{ color: c.ink }}>Pague com Pix</div>
                    {pixData.qrBase64 && (
                      <img src={`data:image/png;base64,${pixData.qrBase64}`} alt="QR Code Pix" className="w-56 h-56 mx-auto rounded-xl bg-white p-2 border border-gray-100" />
                    )}
                    <button
                      onClick={copyPix}
                      className="w-full mt-4 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-95"
                      style={{ backgroundColor: c.ink, color: "#fff", ...heading }}
                    >
                      Copiar código Pix
                    </button>
                    <p className="text-[11px] text-gray-500 mt-3 text-center">
                      A confirmação é automática. Assim que pago, você recebe o acesso por e-mail.
                    </p>
                  </div>
                )}

                {boletoUrl && (
                  <div className="mt-8 p-6 rounded-2xl border text-center" style={{ borderColor: `${c.gold}55`, backgroundColor: "#fdfaf0" }}>
                    <div className="text-sm font-bold mb-3" style={{ color: c.ink }}>Boleto gerado</div>
                    <a
                      href={boletoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block px-6 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-95"
                      style={{ backgroundColor: c.gold, color: c.ink, ...heading }}
                    >
                      Abrir boleto para pagamento
                    </a>
                    <p className="text-[11px] text-gray-500 mt-3">
                      Compensação em até 2 dias úteis. Você receberá o acesso por e-mail assim que confirmado.
                    </p>
                  </div>
                )}
              </>
            )}
          </main>
        </motion.div>
      </div>
    </div>
  );
}
