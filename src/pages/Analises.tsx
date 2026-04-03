import { BarChart3, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const cards = [
  { title: "Receita Total", value: "R$ 0,00", change: "+0%", icon: <DollarSign size={20} />, up: true },
  { title: "Lucro Líquido", value: "R$ 0,00", change: "+0%", icon: <TrendingUp size={20} />, up: true },
  { title: "Despesas", value: "R$ 0,00", change: "0%", icon: <TrendingDown size={20} />, up: false },
  { title: "Clientes Ativos", value: "0", change: "+0", icon: <BarChart3 size={20} />, up: true },
];

const Analises = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Análises</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe as métricas do seu negócio.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.title}</span>
              <span className="text-muted-foreground">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className={`text-xs mt-1 ${card.up ? "text-green-400" : "text-muted-foreground"}`}>{card.change} em relação ao mês anterior</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Gráfico de Receitas</h2>
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          Gráfico será exibido aqui quando houver dados.
        </div>
      </div>
    </div>
  );
};

export default Analises;
