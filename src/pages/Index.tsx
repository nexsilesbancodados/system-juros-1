import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingDashboardPreview from "@/components/landing/LandingDashboardPreview";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingCTA from "@/components/landing/LandingCTA";
import LandingFooter from "@/components/landing/LandingFooter";
import ConstellationBackground from "@/components/ConstellationBackground";

const Index = () => {
  return (
    <div 
      className="min-h-screen bg-black text-white selection:bg-white/20 bg-cover bg-center bg-fixed bg-no-repeat"
      style={{ backgroundImage: "url('/login-bg.png')" }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] -z-10" />
      <ConstellationBackground />
      
      <LandingNavbar />
      
      <main>
        <LandingHero />
        
        {/* Simple Stats Section */}
        <section className="py-20 border-y border-white/5 bg-white/[0.01]">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {[
                { label: "Operações Ativas", value: "2.500+" },
                { label: "Clientes Gestão", value: "150k+" },
                { label: "Recuperação Média", value: "32%" },
                { label: "Segurança de Dados", value: "100%" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl md:text-4xl font-display font-bold text-white mb-2 tracking-tight">
                    {stat.value}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/40 uppercase tracking-widest font-medium">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingFeatures />
        
        <LandingDashboardPreview />
        
        {/* Why Us Section Mockup */}
        <section id="benefits" className="py-24 bg-white/[0.02]">
           <div className="container mx-auto px-6">
              <div className="flex flex-col lg:flex-row items-center gap-16">
                 <div className="flex-1">
                    <h2 className="text-4xl font-display font-bold mb-8">
                       Por que escolher o <span className="text-gradient-gold">System Juros?</span>
                    </h2>
                    <div className="space-y-8">
                       {[
                         { title: "Suporte Especializado", desc: "Atendimento rápido, humano e focado no seu sucesso." },
                         { title: "Atualizações Gratuitas", desc: "Sistema sempre evoluindo com novas funcionalidades." },
                         { title: "Ambiente 100% Seguro", desc: "Proteção avançada para seus dados e informações." },
                         { title: "Foco em Resultados", desc: "Mais controle, menos perda e muito mais lucro." }
                       ].map(item => (
                         <div key={item.title} className="flex gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40 mt-2 flex-shrink-0" />
                            <div>
                               <h3 className="font-bold text-white mb-1">{item.title}</h3>
                               <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
                 <div className="flex-1 relative">
                    <div className="aspect-square rounded-[3rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 p-1 flex items-center justify-center">
                       <div className="w-full h-full rounded-[2.8rem] bg-black flex items-center justify-center overflow-hidden">
                          {/* Inner Visual */}
                          <div className="relative text-center p-12">
                             <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                                <span className="text-4xl">🚀</span>
                             </div>
                             <p className="text-xl font-display font-medium text-white/80">
                                "O melhor investimento para quem quer profissionalizar sua carteira."
                             </p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        <LandingPricing />
        
        <LandingCTA />
      </main>

      <LandingFooter />
    </div>
  );
};

export default Index;
