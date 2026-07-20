import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { XCircle, ArrowLeft } from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";

export default function CheckoutErro() {
  const navigate = useNavigate();
  const { config } = useWhiteLabel();
  const brand = config.companyName || "CredMais App";

  useEffect(() => {
    document.title = `Pagamento não concluído — ${brand}`;
  }, [brand]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
        <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-400/30 flex items-center justify-center mx-auto mb-6">
          <XCircle size={40} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-3">Pagamento não concluído</h1>
        <p className="text-white/60 text-sm leading-relaxed mb-8">
          O pagamento foi cancelado ou recusado. Nenhum valor foi cobrado — você pode tentar novamente
          com outro método a qualquer momento.
        </p>
        <button
          onClick={() => navigate("/checkout")}
          className="w-full py-4 rounded-2xl bg-white text-black font-bold tracking-wide hover:bg-white/90 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft size={18} /> Tentar novamente
        </button>
      </div>
    </div>
  );
}
