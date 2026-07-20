import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowRight, Mail, Loader2 } from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import { supabase } from "@/integrations/supabase/client";

export default function CheckoutSucesso() {
  const navigate = useNavigate();
  const { config } = useWhiteLabel();
  const brand = config.companyName || "CredMais App";
  const [params] = useSearchParams();
  const id = params.get("id");
  const email = params.get("email") || "";
  const [status, setStatus] = useState<string>("approved");
  const [checking, setChecking] = useState(!!id);

  useEffect(() => {
    document.title = `Pagamento aprovado — ${brand}`;
  }, [brand]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const check = async () => {
      try {
        const { data } = await supabase.functions.invoke("mercadopago-check-status", { body: { id } });
        if (!cancelled && (data as any)?.status) setStatus((data as any).status);
      } catch { /* noop */ }
      finally { if (!cancelled) setChecking(false); }
    };
    check();
    return () => { cancelled = true; };
  }, [id]);

  const isApproved = status === "approved";

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto mb-6">
          {checking ? <Loader2 size={40} className="text-emerald-400 animate-spin" /> : <CheckCircle2 size={40} className="text-emerald-400" />}
        </div>
        <h1 className="text-2xl font-display font-bold mb-3">
          {isApproved ? "Pagamento aprovado!" : "Recebemos seu pagamento"}
        </h1>
        <p className="text-white/60 text-sm leading-relaxed mb-6">
          Sua assinatura do <strong>{brand}</strong> foi confirmada. Enviamos um <strong>link de acesso</strong> para
          {email ? <> <strong className="text-white/80">{email}</strong></> : " seu e-mail"} — abra sua caixa de entrada para entrar no painel.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-white/50 bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 mb-8">
          <Mail size={14} className="text-blue-300" />
          Não recebeu? Verifique a caixa de spam ou promoções.
        </div>
        <button
          onClick={() => navigate("/login")}
          className="w-full py-4 rounded-2xl bg-white text-black font-bold tracking-wide hover:bg-white/90 transition-all flex items-center justify-center gap-2"
        >
          Ir para login <ArrowRight size={18} />
        </button>
        {id && (
          <p className="text-[11px] text-white/30 mt-4">ID do pagamento: {id}</p>
        )}
      </div>
    </div>
  );
}
