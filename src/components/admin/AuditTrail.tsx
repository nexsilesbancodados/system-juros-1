import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Search, Filter, Clock } from "lucide-react";

type Log = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
};

type ProfileMin = { id: string; name: string; email: string | null };

export const AuditTrail = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMin>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data as Log[]) || []);

      const ids = Array.from(new Set((data || []).map((l) => l.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", ids);
        const map: Record<string, ProfileMin> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p; });
        setProfiles(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const actions = Array.from(new Set(logs.map((l) => l.action)));
  const filtered = logs.filter((l) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search.trim()) {
      const p = profiles[l.user_id];
      const q = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        l.entity_type.toLowerCase().includes(q) ||
        p?.name?.toLowerCase().includes(q) ||
        p?.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Activity size={18} /> Trilha de Auditoria
        </h2>
        <p className="text-sm text-muted-foreground">Últimas 200 ações registradas no sistema.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por ação, entidade ou usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground"
        >
          <option value="all">Todas as ações</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border">
          <Activity size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-card divide-y divide-border max-h-[600px] overflow-y-auto">
          {filtered.map((l) => {
            const p = profiles[l.user_id];
            return (
              <div key={l.id} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/15 text-primary font-medium">
                        {l.action}
                      </span>
                      <span className="text-xs text-muted-foreground">{l.entity_type}</span>
                      {l.entity_id && (
                        <span className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[120px]">
                          #{l.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-1 truncate">
                      por <span className="font-medium">{p?.name || "—"}</span>
                      {p?.email && <span className="text-muted-foreground"> ({p.email})</span>}
                    </p>
                    {l.details && (
                      <p className="text-[11px] text-muted-foreground/80 font-mono mt-1 truncate">
                        {JSON.stringify(l.details).slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <Clock size={11} />
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
