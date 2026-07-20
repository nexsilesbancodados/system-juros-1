import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";

export default function CheckoutSucesso() {
  const navigate = useNavigate();
  const { config } = useWhiteLabel();
  const brand = config.companyName || "CredMais App";

  useEffect(() => {
    document.title = `Pagamento aprovado — ${brand}`;
  }, [brand]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-3">Pagamento aprovado!</h1>
        <p className="text-white/60 text-sm leading-relaxed mb-8">
          Recebemos sua assinatura do <strong>{brand}</strong>. Enviamos um <strong>link mágico</strong> para
          seu e-mail com o acesso — abra sua caixa de entrada para entrar no painel.
        </p>
        <button
          onClick={() => navigate("/login")}
          className="w-full py-4 rounded-2xl bg-white text-black font-bold tracking-wide hover:bg-white/90 transition-all flex items-center justify-center gap-2"
        >
          Ir para login <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
