import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";

const Carteira = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carteira</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu saldo e movimentações.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={18} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Saldo Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ 0,00</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={18} className="text-green-400" />
            <span className="text-sm text-muted-foreground">Entradas</span>
          </div>
          <p className="text-2xl font-bold text-green-400">R$ 0,00</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight size={18} className="text-destructive" />
            <span className="text-sm text-muted-foreground">Saídas</span>
          </div>
          <p className="text-2xl font-bold text-destructive">R$ 0,00</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Histórico de Transações</h2>
        <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma transação registrada.</div>
      </div>
    </div>
  );
};

export default Carteira;
