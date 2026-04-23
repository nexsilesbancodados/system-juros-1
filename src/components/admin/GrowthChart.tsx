import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";

type Point = { date: string; users: number; cumulative: number };

export const GrowthChart = () => {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { data: rows } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: true });

      const buckets: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        buckets[d.toISOString().split("T")[0]] = 0;
      }
      (rows || []).forEach((r: any) => {
        const k = new Date(r.created_at).toISOString().split("T")[0];
        if (k in buckets) buckets[k]++;
      });

      let cum = 0;
      const points: Point[] = Object.entries(buckets).map(([date, users]) => {
        cum += users;
        return { date, users, cumulative: cum };
      });
      setData(points);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="h-48 rounded-2xl bg-muted/40 animate-pulse" />;
  }

  const max = Math.max(...data.map((p) => p.users), 1);
  const totalNew = data.reduce((s, p) => s + p.users, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={14} /> Crescimento (30 dias)
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">+{totalNew} novos usuários</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-1 h-32">
        {data.map((p, i) => {
          const h = (p.users / max) * 100;
          return (
            <div key={p.date} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-t bg-gradient-to-t from-primary/80 to-primary/40 hover:from-primary hover:to-primary/60 transition-colors min-h-[2px]"
                style={{ height: `${h}%` }}
              />
              {p.users > 0 && (
                <div className="absolute -top-7 hidden group-hover:block bg-popover border border-border rounded px-2 py-1 text-xs text-foreground whitespace-nowrap z-10 shadow-lg">
                  {p.users} em {new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
        <span>{new Date(data[0]?.date || "").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
        <span>Hoje</span>
      </div>
    </div>
  );
};
