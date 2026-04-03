import {
  AlertCircle,
  Calendar,
  Landmark,
  TrendingUp,
  Users,
  Wallet,
  ArrowRight,
  HandCoins,
  Smartphone,
  Car,
  Bike,
} from "lucide-react";

const attentionCards = [
  {
    title: "0 Pagamentos Atrasados",
    subtitle: "Total de R$ 0,00 em aberto.",
    link: "Ver Cobranças",
    icon: <AlertCircle size={20} />,
    accent: true,
  },
  {
    title: "0 Próximos Vencimentos",
    subtitle: "R$ 0,00 a receber nos próximos dias.",
    link: "Ver Cobranças",
    icon: <Calendar size={20} />,
    accent: false,
  },
];

const overviewCards = [
  { title: "Capital na Rua", value: "R$ 0,00", subtitle: "Total emprestado aos clientes", icon: <Landmark size={20} /> },
  { title: "Lucro a Receber", value: "R$ 0,00", subtitle: "Juros pendentes de pagamento", icon: <TrendingUp size={20} /> },
  { title: "Clientes Ativos", value: "0", subtitle: "Clientes com contratos em aberto", icon: <Users size={20} /> },
  { title: "Saldo em Caixa", value: "R$ 0,00", subtitle: "Dinheiro disponível para operar", icon: <Wallet size={20} /> },
];

const categoryCards = [
  { title: "Lucro de Empréstimos", value: "R$ 0,00", subtitle: "Total de juros recebidos", icon: <HandCoins size={20} /> },
  { title: "Receita de Celulares", value: "R$ 0,00", subtitle: "Total recebido de vendas", icon: <Smartphone size={20} /> },
  { title: "Receita de Carros", value: "R$ 0,00", subtitle: "Total de aluguéis de carros", icon: <Car size={20} /> },
  { title: "Receita de Motos", value: "R$ 0,00", subtitle: "Total de aluguéis de motos", icon: <Bike size={20} /> },
];

const Dashboard = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel de Controle</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bem-vindo(a) de volta! Aqui está um resumo do seu negócio.
        </p>
      </div>

      {/* Attention Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">O Que Precisa da sua Atenção?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Ações e pagamentos que necessitam de uma ação imediata.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attentionCards.map((card) => (
            <div
              key={card.title}
              className={`rounded-lg border p-4 ${
                card.accent
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-accent/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={card.accent ? "text-destructive" : "text-foreground"}>{card.icon}</span>
                <span className={`font-semibold text-sm ${card.accent ? "text-destructive" : "text-foreground"}`}>
                  {card.title}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{card.subtitle}</p>
              <button className={`flex items-center gap-1 text-sm font-medium ${card.accent ? "text-destructive" : "text-foreground"}`}>
                {card.link} <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Overview */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Visão Geral</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.title}</span>
                <span className="text-muted-foreground">{card.icon}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Lucros por Categoria</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.title}</span>
                <span className="text-muted-foreground">{card.icon}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
