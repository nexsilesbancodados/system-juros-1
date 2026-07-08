import { useWhiteLabel } from "@/contexts/WhiteLabelContext";
import eagleLogo from "@/assets/eagle-logo.webp";
import { Mail, Phone, MapPin, Globe, Share2, Info } from "lucide-react";

const LandingFooter = () => {
  const { config } = useWhiteLabel();
  const brandTitle = config.companyName || "SYSTEM JUROS";

  return (
    <footer id="contact" className="pt-20 pb-10 bg-black border-t border-white/5">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <img src={config.companyLogo || eagleLogo} alt={brandTitle} className="w-10 h-10 rounded-full" />
              <span className="font-display text-xl font-bold tracking-widest text-gradient-gold">
                {brandTitle}
              </span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              O sistema completo para gestão de empréstimos, clientes, parcelas e cobranças. Mais controle, segurança e resultados para o seu negócio.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Globe size={18} className="text-white/60" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Share2 size={18} className="text-white/60" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Info size={18} className="text-white/60" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-white mb-6">Navegação</h4>
            <ul className="space-y-4">
              {["Início", "Recursos", "Benefícios", "Planos", "Depoimentos", "Contato"].map((item) => (
                <li key={item}>
                  <a href={`#${item.toLowerCase()}`} className="text-white/70 hover:text-white text-sm transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-white mb-6">Recursos</h4>
            <ul className="space-y-4">
              {["Gestão de Clientes", "Controle de Parcelas", "Relatórios", "Alertas e Lembretes", "Segurança", "Integrações"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-white/70 hover:text-white text-sm transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-white mb-6">Fale Conosco</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-white/70 text-sm">
                <Phone size={16} className="text-white/60" />
                (11) 99999-9999
              </li>
              <li className="flex items-center gap-3 text-white/70 text-sm">
                <Mail size={16} className="text-white/60" />
                contato@systemjuros.com.br
              </li>
              <li className="flex items-center gap-3 text-white/70 text-sm">
                <MapPin size={16} className="text-white/60" />
                São Paulo - SP
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-white/60 tracking-wider">
            © 2025 {brandTitle} — TODOS OS DIREITOS RESERVADOS.
          </p>
          <div className="flex gap-6">
            <a href="/privacidade" className="text-[10px] text-white/60 hover:text-white transition-colors">Política de Privacidade</a>
            <a href="/privacidade" className="text-[10px] text-white/60 hover:text-white transition-colors">Termos de Uso</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
