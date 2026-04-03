import { Bell, Wallet, TrendingUp, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const TopBar = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-end px-6 gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Wallet size={16} />
        <span>R$ {Number(profile?.loan_balance || 0).toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendingUp size={16} />
        <span>R$ {Number(profile?.profit_balance || 0).toFixed(2)}</span>
      </div>
      <button className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
        <Bell size={18} />
      </button>
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-foreground">
        {profile?.name?.charAt(0)?.toUpperCase() || "U"}
      </div>
      <button onClick={handleSignOut} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground" title="Sair">
        <LogOut size={18} />
      </button>
    </header>
  );
};

export default TopBar;
