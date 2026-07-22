import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fetchAll } from "@/lib/fetchAll";
import { Archive, TrendingUp, Wallet, HandCoins, Search, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBR } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import EmptyState from "@/components/EmptyState";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HistoricoFinanceiro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["historico-financeiro", user?.id],
    queryFn: async () => {
      const [contracts, installments] = await Promise.all([
        fetchAll((f, t) =>
          supabase.from("contracts")
            .select("*, clients(name, cpf_cnpj)")
            .eq("user_id", user!.id).eq("status", "completed")
            .order("created_at", { ascending: false }).range(f, t)
        ),
        fetchAll((f, t) =>
          supabase.from("contract_installments").select("*")
            .eq("user_id", user!.id).eq("status", "paid").range(f, t)
        ),
      ]);
      return { contracts, installments };
    },
    enabled: !!user,
  });

  const summary = useMemo(() => {
    if (!data) return null;
    const ids = new Set(data.contracts.map((c: any) => c.id));
    const paidHere = data.installments.filter((i: any) => ids.has(i.contract_id));
    const totalRecebido = paidHere.reduce((s: number, i: any) =>
      s + Number(i.paid_amount || i.amount || 0), 0);
    const totalCapital = data.contracts.reduce((s: number, c: any) =>
      s + Number(c.capital || 0), 0);
    const totalLucro = data.contracts.reduce((s: number, c: any) =>
      s + Number(c.total_interest || 0), 0);
    return {
      totalRecebido,
      totalCapital,
      totalLucro,
      quantidade: data.contracts.length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.toLowerCase().trim();
    if (!term) return data.contracts;
    return data.contracts.filter((c: any) =>
      c.clients?.name?.toLowerCase().includes(term) ||
      c.clients?.cpf_cnpj?.includes(term)
    );
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-500/20 to-slate-500/5 border border-slate-500/20 flex items-center justify-center">
            <Archive className="text-slate-400" size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Histórico financeiro</h1>
            <p className="text-sm text-muted-foreground">
              Contratos quitados e lucros já realizados — fora das métricas ativas.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={FileText} label="Contratos quitados" value={String(summary?.quantidade ?? 0)} tone="slate" />
        <KPI icon={HandCoins} label="Capital histórico" value={`R$ ${fmt(summary?.totalCapital ?? 0)}`} tone="indigo" />
        <KPI icon={Wallet} label="Recebido histórico" value={`R$ ${fmt(summary?.totalRecebido ?? 0)}`} tone="success" />
        <KPI icon={TrendingUp} label="Lucro histórico" value={`R$ ${fmt(summary?.totalLucro ?? 0)}`} tone="primary" />
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente ou CPF/CNPJ..."
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Nada arquivado ainda"
          description="Quando um contrato for quitado, ele aparece aqui junto do lucro realizado."
        />
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-[11px] uppercase tracking-wider font-bold text-muted-foreground border-b border-border/40 bg-muted/20">
            <span>Cliente / contrato</span>
            <span className="text-right">Capital</span>
            <span className="text-right">Total pago</span>
            <span className="text-right">Lucro</span>
          </div>
          {filtered.map((c: any) => {
            const recebido = data!.installments
              .filter((i: any) => i.contract_id === c.id)
              .reduce((s: number, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/clientes/${c.client_id}`)}
                className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 items-center border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {c.clients?.name || "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] h-5 border-slate-500/30 text-slate-400">
                      Quitado
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatBR(c.created_at)} · {c.num_installments}x
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  R$ {fmt(Number(c.capital))}
                </span>
                <span className="text-sm font-semibold tabular-nums text-success">
                  R$ {fmt(recebido)}
                </span>
                <span className="text-sm font-black tabular-nums text-primary">
                  R$ {fmt(Number(c.total_interest || 0))}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KPI({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: string; tone: "slate" | "indigo" | "success" | "primary" }) {
  const map = {
    slate:   { bg: "bg-slate-500/10",   ring: "ring-slate-500/20",   text: "text-slate-400" },
    indigo:  { bg: "bg-indigo-500/10",  ring: "ring-indigo-500/20",  text: "text-indigo-400" },
    success: { bg: "bg-success/10",     ring: "ring-success/20",     text: "text-success" },
    primary: { bg: "bg-primary/10",     ring: "ring-primary/20",     text: "text-primary" },
  }[tone];
  return (
    <div className={`rounded-2xl border border-border/40 bg-card/40 backdrop-blur p-4 ring-1 ${map.ring}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${map.bg} flex items-center justify-center`}>
          <Icon size={14} className={map.text} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-black tabular-nums ${map.text}`}>{value}</p>
    </div>
  );
}
