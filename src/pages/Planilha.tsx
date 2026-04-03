import { Table } from "lucide-react";

const Planilha = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Planilha</h1>
        <p className="text-muted-foreground text-sm mt-1">Visualize dados em formato de planilha.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-center py-12">
        <Table size={48} className="mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Funcionalidade em desenvolvimento.</p>
      </div>
    </div>
  );
};

export default Planilha;
