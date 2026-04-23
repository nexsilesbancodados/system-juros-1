import { useState, useEffect } from "react";
import { Users, Ban, CheckCircle, Search, Shield, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    const ch = supabase
      .channel("realtime-admin-profiles")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "profiles" }, () => fetchUsers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-20">
        <Shield size={64} className="mx-auto text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_blocked: !currentBlocked })
      .eq("id", userId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: currentBlocked ? "Usuário desbloqueado!" : "Usuário bloqueado!" });
      fetchUsers();
    }
  };

  const handleToggleChatBlock = async (userId: string, current: boolean) => {
    await supabase.from("profiles").update({ is_chat_blocked: !current }).eq("id", userId);
    toast({ title: current ? "Chat desbloqueado!" : "Chat bloqueado!" });
    fetchUsers();
  };

  const handleSetSubscription = async (userId: string, type: string) => {
    const expiresAt = new Date();
    if (type === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);
    else if (type === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await supabase.from("profiles").update({
      subscription_type: type,
      subscription_expires_at: expiresAt.toISOString(),
    }).eq("id", userId);
    toast({ title: "Assinatura atualizada!" });
    fetchUsers();
  };

  const filtered = users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    blocked: users.filter((u) => u.is_blocked).length,
    admins: users.filter((u) => u.is_admin).length,
    monthly: users.filter((u) => u.subscription_type === "monthly").length,
    yearly: users.filter((u) => u.subscription_type === "yearly").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Crown size={24} /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie usuários, assinaturas e permissões.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Usuários", value: stats.total },
          { label: "Bloqueados", value: stats.blocked },
          { label: "Admins", value: stats.admins },
          { label: "Plano Mensal", value: stats.monthly },
          { label: "Plano Anual", value: stats.yearly },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="rounded-2xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-accent/50">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Usuário</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Email</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Plano</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Expira</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-foreground">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          u.name?.charAt(0)?.toUpperCase() || "U"
                        )}
                      </div>
                      <div>
                        <p className="text-foreground font-medium">{u.name}</p>
                        {u.is_admin && <span className="text-[10px] text-primary font-bold">ADMIN</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email || "-"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.subscription_type || "monthly"}
                      onChange={(e) => handleSetSubscription(u.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded bg-input border border-border text-foreground"
                    >
                      <option value="monthly">Mensal</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {u.subscription_expires_at
                      ? new Date(u.subscription_expires_at).toLocaleDateString("pt-BR")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      u.is_blocked ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-400"
                    }`}>
                      {u.is_blocked ? "Bloqueado" : "Ativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleBlock(u.id, u.is_blocked)}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          u.is_blocked ? "hover:bg-green-500/20 text-green-400" : "hover:bg-destructive/20 text-destructive"
                        }`}
                        title={u.is_blocked ? "Desbloquear" : "Bloquear"}
                      >
                        {u.is_blocked ? <CheckCircle size={16} /> : <Ban size={16} />}
                      </button>
                      <button
                        onClick={() => handleToggleChatBlock(u.id, u.is_chat_blocked)}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          u.is_chat_blocked ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground hover:text-destructive"
                        }`}
                        title={u.is_chat_blocked ? "Desbloquear chat" : "Bloquear chat"}
                      >
                        💬{u.is_chat_blocked && "🚫"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Admin;
