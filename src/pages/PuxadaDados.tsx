import { Database, Search } from "lucide-react";

const PuxadaDados = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Puxada de Dados</h1>
        <p className="text-muted-foreground text-sm mt-1">Consulte informações de CPF/CNPJ.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4 max-w-xl">
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">CPF ou CNPJ</label>
          <div className="flex gap-2">
            <input type="text" placeholder="000.000.000-00" className="flex-1 px-3 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <button className="px-4 py-2.5 rounded-lg text-primary-foreground text-sm font-semibold" style={{ background: "var(--gradient-button)" }}>
              <Search size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-center py-12">
        <Database size={48} className="mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Faça uma consulta para ver os resultados.</p>
      </div>
    </div>
  );
};

export default PuxadaDados;
