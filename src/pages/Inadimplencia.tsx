import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown, Users, DollarSign, Clock, ArrowRight, Phone, Sparkles } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { differenceInDays } from "date-fns";

interface Installment {
  id: string;
  client_id: string;
  contract_id: string;
  amount: number;
  due_date: string;
  status: string;
  late_fee: number | null;
}

interface Client {
  id: string;
  name: string;
  whatsapp: string | null;
  phone: string | null;
  credit_score: number | null;
}

interface OverdueRow {
  client: Client;
  totalDue: number;
  oldestDays: number;
  installments: number;
  bucket: "0-30" | "31-60" | "61-90" | "90+";
}

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const Inadimplencia = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = new Date().toISOString();
    const { data: insts } = await supabase
      .from("contract_installments")
      .select("id, client_id, contract_id, amount, due_date, status, late_fee")
      .eq("user_id", user.id)
      .neq("status", "paid")
      .lt("due_date", today);

    const ids = Array.from(new Set((insts || []).map(i => i.client_id)));
    let cmap: Record<string, Client> = {};
    if (ids.length) {
      const { data: cs } = await supabase
        .from("clients")
        .select("id, name, whatsapp, phone, credit_score")
        .in("id", ids);
      cmap = Object.fromEntries((cs || []).map(c => [c.id, c]));
    }
    setInstallments(insts || []);
    setClients(cmap);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`realtime-inadimplencia-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "contract_installments" }, () => load())
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "clients" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const { kpis, byClient, byBucket } = useMemo(() => {
    const today = new Date();
    const map = new Map<string, OverdueRow>();
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } as Record<OverdueRow["bucket"], number>;
    let total = 0;

    for (const inst of installments) {
      const days = differenceInDays(today, new Date(inst.due_date));
      if (days < 1) continue;
      const due = Number(inst.amount) + Number(inst.late_fee || 0);
      total += due;
      const bucket: OverdueRow["bucket"] = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      buckets[bucket] += due;

      const c = clients[inst.client_id];
      if (!c) continue;
      const cur = map.get(inst.client_id);
      if (cur) {
        cur.totalDue += due;
        cur.installments += 1;
        if (days > cur.oldestDays) {
          cur.oldestDays = days;
          cur.bucket = bucket;
        }
      } else {
        map.set(inst.client_id, { client: c, totalDue: due, oldestDays: days, installments: 1, bucket });
      }
    }

    const rows = Array.from(map.values()).sort((a, b) => b.totalDue - a.totalDue);
    return {
      byClient: rows,
      byBucket: buckets,
      kpis: {
        total,
        clients: rows.length,
        installments: installments.length,
        avgDays: rows.length ? Math.round(rows.reduce((s, r) => s + r.oldestDays, 0) / rows.length) : 0,
      },
    };
  }, [installments, clients]);

  const bucketColor = (b: OverdueRow["bucket"]) =>
    b === "0-30" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : b === "31-60" ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
    : b === "61-90" ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
    : "bg-red-600/20 text-red-300 border-red-600/40";

  const sendWA = (c: Client, totalDue: number) => {
    const num = (c.whatsapp || c.phone || "").replace(/\D/g, "");
    if (!num) return;
    const msg = encodeURIComponent(`Olá ${c.name}, identificamos um saldo em aberto de ${fmtBRL(totalDue)}. Podemos regularizar?`);
    window.open(`https://wa.me/55${num}?text=${msg}`, "_blank");
  };

  const maxBucket = Math.max(...Object.values(byBucket), 1);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-rose-400" size={26} />
            Inadimplência
          </h1>
          <p className="text-sm text-muted-foreground">Painel de aging, devedores e ações de cobrança</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/cobrancas")}>
          Ir para cobranças <ArrowRight size={14} className="ml-1" />
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total em atraso", value: fmtBRL(kpis.total), icon: DollarSign, color: "text-rose-400" },
          { label: "Clientes inadimplentes", value: kpis.clients, icon: Users, color: "text-amber-400" },
          { label: "Parcelas vencidas", value: kpis.installments, icon: TrendingDown, color: "text-orange-400" },
          { label: "Média de dias atraso", value: `${kpis.avgDays}d`, icon: Clock, color: "text-violet-400" },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <k.icon size={16} className={k.color} />
            </div>
            {loading ? <Skeleton className="h-7 w-24" /> : <p className="text-xl font-bold">{k.value}</p>}
          </Card>
        ))}
      </div>

      {/* Aging buckets */}
      <Card className="p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock size={16} className="text-primary" /> Aging — distribuição por dias de atraso
        </h2>
        <div className="space-y-3">
          {(Object.keys(byBucket) as OverdueRow["bucket"][]).map((b) => {
            const v = byBucket[b];
            const pct = (v / maxBucket) * 100;
            return (
              <div key={b}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <Badge variant="outline" className={bucketColor(b)}>{b} dias</Badge>
                  <span className="font-semibold">{fmtBRL(v)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      b === "0-30" ? "bg-amber-500" : b === "31-60" ? "bg-orange-500" : b === "61-90" ? "bg-rose-500" : "bg-red-600"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top devedores */}
      <Card className="p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users size={16} className="text-primary" /> Top devedores
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : byClient.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Carteira saudável"
            description="Nenhum cliente em atraso no momento. Continue acompanhando os vencimentos."
            compact
          />
        ) : (
          <div className="space-y-2">
            {byClient.slice(0, 20).map((row) => (
              <div
                key={row.client.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/40 hover:border-primary/40 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => navigate(`/clientes/${row.client.id}`)}
                      className="font-semibold text-sm hover:text-primary truncate"
                    >
                      {row.client.name}
                    </button>
                    <Badge variant="outline" className={bucketColor(row.bucket)}>
                      {row.oldestDays}d
                    </Badge>
                    {row.installments > 1 && (
                      <Badge variant="outline" className="text-[10px]">{row.installments} parcelas</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Score: {row.client.credit_score ?? 100} • {row.client.whatsapp || row.client.phone || "Sem contato"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-rose-400">{fmtBRL(row.totalDue)}</p>
                </div>
                {(row.client.whatsapp || row.client.phone) && (
                  <Button size="sm" variant="outline" onClick={() => sendWA(row.client, row.totalDue)} className="shrink-0">
                    <Phone size={13} className="mr-1" /> Cobrar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Inadimplencia;
