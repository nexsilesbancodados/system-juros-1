import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Calendar, Clock, MessageSquare, DollarSign,
  CheckCircle, RefreshCw, Search, Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MesaCobranca = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["mesa-cobranca", user?.id],
    queryFn: async () => {
      const [contracts, installments] = await Promise.all([
        supabase.from("contracts").select("*, clients(name, cpf_cnpj, phone, whatsapp)").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*").eq("user_id", user!.id).eq("status", "pending"),
      ]);
      return { contracts: contracts.data || [], installments: installments.data || [] };
    },
    enabled: !!user,
  });

  const categorized = useMemo(() => {
    if (!data) return { overdue: [], today: [], next7: [] };
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const in7 = new Date(now.getTime() + 7 * 86400000);

    const enrich = (inst: any) => {
      const contract = data.contracts.find((c: any) => c.id === inst.contract_id);
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(inst.due_date).getTime()) / 86400000));
      return { ...inst, client: contract?.clients, contractId: inst.contract_id, daysOverdue };
    };

    const overdue = data.installments
      .filter((i: any) => new Date(i.due_date) < now && !i.due_date.startsWith(todayStr))
      .map(enrich)
      .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    const today = data.installments
      .filter((i: any) => i.due_date.startsWith(todayStr))
      .map(enrich);

    const next7 = data.installments
      .filter((i: any) => {
        const d = new Date(i.due_date);
        return d > now && d <= in7 && !i.due_date.startsWith(todayStr);
      })
      .map(enrich)
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    return { overdue, today, next7 };
  }, [data]);

  const handlePay = async (instId: string, amount: number) => {
    const { error } = await supabase
      .from("contract_installments")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: amount })
      .eq("id", instId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pagamento registrado!" });
      queryClient.invalidateQueries({ queryKey: ["mesa-cobranca"] });
    }
  };

  const handleWhatsApp = (phone: string | null, clientName: string) => {
    if (!phone) {
      toast({ title: "Sem número", description: "Cliente não tem WhatsApp cadastrado.", variant: "destructive" });
      return;
    }
    const clean = phone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá ${clientName}, estamos entrando em contato sobre sua parcela pendente.`);
    window.open(`https://wa.me/55${clean}?text=${msg}`, "_blank");
  };

  const filtered = (items: any[]) =>
    items.filter((i) =>
      !search || i.client?.name?.toLowerCase().includes(search.toLowerCase()) || i.client?.cpf_cnpj?.includes(search)
    );

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const renderCard = (item: any, type: "overdue" | "today" | "next7") => (
    <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-foreground text-sm">{item.client?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">{item.client?.cpf_cnpj || ""}</p>
        </div>
        {type === "overdue" && (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
            {item.daysOverdue}d atraso
          </Badge>
        )}
        {type === "today" && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            Vence hoje
          </Badge>
        )}
        {type === "next7" && (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            {new Date(item.due_date).toLocaleDateString("pt-BR")}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Parcela {item.installment_number}</span>
        <span className="font-semibold text-foreground">R$ {fmt(Number(item.amount))}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleWhatsApp(item.client?.whatsapp || item.client?.phone, item.client?.name)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
        >
          <MessageSquare size={13} /> WhatsApp
        </button>
        <button
          onClick={() => handlePay(item.id, Number(item.amount))}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <DollarSign size={13} /> Registrar Pgto
        </button>
        <button
          onClick={() => navigate(`/contratos/${item.contractId}`)}
          className="px-3 py-2 rounded-lg text-xs font-medium bg-accent text-foreground hover:bg-accent/70 transition-colors"
        >
          Ver
        </button>
      </div>
    </div>
  );

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mesa de Cobrança</h1>
          <p className="text-sm text-muted-foreground">Central operacional de cobrança</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Atrasados", value: categorized.overdue.length, icon: <AlertTriangle size={18} />, color: "text-red-500", bg: categorized.overdue.length > 0 ? "border-red-500/30 bg-red-500/5" : "" },
          { label: "Vencendo Hoje", value: categorized.today.length, icon: <Calendar size={18} />, color: "text-amber-500", bg: categorized.today.length > 0 ? "border-amber-500/30 bg-amber-500/5" : "" },
          { label: "Próximos 7 Dias", value: categorized.next7.length, icon: <Clock size={18} />, color: "text-blue-500", bg: "" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-border bg-card p-5 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={s.color}>{s.icon}</span>
              <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
            </div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Sections */}
      {[
        { title: "🔴 Atrasados", items: filtered(categorized.overdue), type: "overdue" as const },
        { title: "🟡 Vencendo Hoje", items: filtered(categorized.today), type: "today" as const },
        { title: "🔵 Próximos 7 Dias", items: filtered(categorized.next7), type: "next7" as const },
      ].map((section) => (
        <div key={section.title}>
          <h2 className="text-sm font-semibold text-foreground mb-3">{section.title} ({section.items.length})</h2>
          {section.items.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-border rounded-xl bg-card">
              Nenhuma parcela nesta categoria
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item: any) => renderCard(item, section.type))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MesaCobranca;
