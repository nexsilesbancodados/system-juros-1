import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, Plus, ArrowUpRight, ArrowDownLeft, Search, Filter, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const typeLabels: Record<string, string> = {
  receipt: "Recebimento",
  loan: "Empréstimo",
  expense: "Despesa",
  other: "Outro",
};

const typeColors: Record<string, string> = {
  receipt: "text-emerald-500",
  loan: "text-blue-500",
  expense: "text-red-500",
  other: "text-muted-foreground",
};

const Tesouraria = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Form state
  const [formType, setFormType] = useState("receipt");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, clients(name)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = transactions.filter((t: any) => {
    const matchSearch = !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.clients?.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || t.type === typeFilter;
    return matchSearch && matchType;
  });

  const totals = transactions.reduce(
    (acc: any, t: any) => {
      const amt = Number(t.amount);
      if (t.type === "receipt") acc.in += amt;
      else if (t.type === "expense") acc.out += amt;
      else if (t.type === "loan") acc.out += amt;
      return acc;
    },
    { in: 0, out: 0 }
  );

  const saldo = totals.in - totals.out;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: formType,
      description: formDesc,
      amount: parseFloat(formAmount),
      category: formCategory || null,
      date: new Date(formDate + "T12:00:00").toISOString(),
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Transação adicionada!" });
      setShowForm(false);
      setFormDesc("");
      setFormAmount("");
      setFormCategory("");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tesouraria</h1>
          <p className="text-sm text-muted-foreground">Controle financeiro completo</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}
        >
          <Plus size={16} />
          Nova Transação
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={18} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase">Saldo Atual</span>
          </div>
          <p className={`text-2xl font-bold ${saldo >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            R$ {fmt(saldo)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownLeft size={18} className="text-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase">Entradas</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">R$ {fmt(totals.in)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={18} className="text-red-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase">Saídas</span>
          </div>
          <p className="text-2xl font-bold text-red-500">R$ {fmt(totals.out)}</p>
        </div>
      </div>

      {/* New Transaction Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Nova Transação</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value)} className={inputCls}>
                <option value="receipt">Recebimento</option>
                <option value="loan">Empréstimo</option>
                <option value="expense">Despesa</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor (R$)</label>
              <input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
              <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Descrição" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
              <input type="text" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="Opcional" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-button, hsl(var(--primary)))" }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar transação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          {["all", "receipt", "loan", "expense", "other"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "Todos" : typeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma transação encontrada</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {filtered.map((t: any) => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className={`p-2 rounded-lg ${t.type === "receipt" ? "bg-emerald-500/10" : t.type === "expense" ? "bg-red-500/10" : "bg-accent"}`}>
                {t.type === "receipt" ? <ArrowDownLeft size={16} className="text-emerald-500" /> : <ArrowUpRight size={16} className={t.type === "expense" ? "text-red-500" : "text-blue-500"} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.date).toLocaleDateString("pt-BR")}
                  {t.category && ` · ${t.category}`}
                  {t.clients?.name && ` · ${t.clients.name}`}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${typeColors[t.type]}`}>
                  {t.type === "receipt" ? "+" : "-"}R$ {fmt(Number(t.amount))}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {typeLabels[t.type]}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tesouraria;
