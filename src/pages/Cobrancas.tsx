import { Receipt } from "lucide-react";

const Cobrancas = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cobranças</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe pagamentos e parcelas dos clientes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Em Dia</p>
          <p className="text-2xl font-bold text-green-400 mt-1">0</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Atrasados</p>
          <p className="text-2xl font-bold text-destructive mt-1">0</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Pendente</p>
          <p className="text-2xl font-bold text-foreground mt-1">R$ 0,00</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-center py-12">
        <Receipt size={48} className="mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhuma cobrança pendente.</p>
      </div>
    </div>
  );
};

export default Cobrancas;
