import { Bell, Wallet, TrendingUp } from "lucide-react";

const TopBar = () => {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-end px-6 gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Wallet size={16} />
        <span>R$ 0,00</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendingUp size={16} />
        <span>R$ 0,00</span>
      </div>
      <button className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
        <Bell size={18} />
      </button>
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-foreground">
        G
      </div>
    </header>
  );
};

export default TopBar;
