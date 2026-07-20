import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ArrowRight } from "lucide-react";
import { useWhiteLabel } from "@/contexts/WhiteLabelContext";

export default function CheckoutPendente() {
  const navigate = useNavigate();
  const { config } = useWhiteLabel();
  const brand = config.companyName || "CredMais App";

  useEffect(() => {
    document.title = `Pagamento pendente — ${brand}`;
  }, [brand]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center p-10 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
        <div className="w-20 h-20 rounded-full bg-yellow-500/15 border border-yellow-400/30 flex items-center justify-center mx-auto mb-6">
          <Clock size={40} className="text-yellow-400" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-3">Pagamento pendente</h1>
        <p className="text-white/60 text-sm leading-relaxed mb-8">
          Estamos aguardando a confirmação do <strong>{brand}</strong>. Assim que aprovado, você receberá
          um e-mail com o link de acesso — normalmente leva poucos minutos (ou até 1 dia útil no boleto).
        </p>
        <button
          onClick={() => navigate("/")}
          className="w-full py-4 rounded-2xl bg-white text-black font-bold tracking-wide hover:bg-white/90 transition-all flex items-center justify-center gap-2"
        >
          Voltar ao início <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
