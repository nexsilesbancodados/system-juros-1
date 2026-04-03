import eagleLogo from "@/assets/eagle-logo.webp";
import { Info } from "lucide-react";

const Sobre = () => {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sobre</h1>
        <p className="text-muted-foreground text-sm mt-1">Informações sobre o sistema.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <img src={eagleLogo} alt="Urus Jurista" width={80} height={80} className="mx-auto mb-4 rounded-full" />
        <h2 className="font-display text-xl tracking-widest text-foreground mb-2">URUS JURISTA</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Sistema completo de gestão financeira e de clientes.
        </p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Versão: 1.0.0</p>
          <p>© 2026 Urus Jurista. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default Sobre;
