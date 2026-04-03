import { useState, useEffect } from "react";
import { Receipt, Check, MessageSquare, Filter, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Installment {
  id: string;
  client_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: string;
  client_name?: string;
  client_phone?: string;
}

const Cobrancas = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "overdue" | "paid">("all");
  const [search, setSearch] = useState("");

  const fetchInstallments = async () => {
    if (!user) return;
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, phone")
      .eq("user_id", user.id);

    const clientMap = new Map((clients || []).map((c) => [c.id, { name: c.name, phone: c.phone }]));

    const { data } = await supabase
      .from("installments")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true });

    const enriched = (data || []).map((inst) => {
      const client = clientMap.get(inst.client_id);
      // Auto-detect overdue
      const isOverdue = inst.status === "pending" && new Date(inst.due_date) < new Date();
      return {
        ...inst,
        status: isOverdue ? "overdue" : inst.status,
        client_name: client?.name || "Cliente desconhecido",
        client_phone: client?.phone || null,
      };
    });

    setInstallments(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchInstallments();
  }, [user]);

  const handleMarkPaid = async (id: string) => {
    const { error } = await supabase
      .from("installments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Parcela marcada como paga!" });
      fetchInstallments();
    }
  };

  const handleWhatsApp = (inst: Installment) => {
    if (!inst.client_phone) {
      toast({ title: "Sem telefone", description: "Este cliente não tem telefone cadastrado.", variant: "destructive" });
      return;
    }

    const phone = inst.client_phone.replace(/\D/g, "");
    const billingTemplate = profile?.billing_message || 
      `Olá {nome}, identificamos que sua parcela {parcela} no valor de R$ {valor} venceu em {data}. Por favor, entre em contato para regularizar.`;

    const message = billingTemplate
      .replace(/\{nome\}|\[Nome do Cliente\]/g, inst.client_name || "")
      .replace(/\{parcela\}/g, `${inst.installment_number}`)
      .replace(/\{valor\}|\[Valor da Parcela\]/g, Number(inst.amount).toFixed(2))
      .replace(/\{data\}/g, new Date(inst.due_date).toLocaleDateString("pt-BR"))
      .replace(/\[Nome da Empresa\]/g, "Urus Jurista")
      .replace(/Sr\(a\)\s*/g, "");

    const url = `https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const filtered = installments.filter((inst) => {
    if (filter !== "all" && inst.status !== filter) return false;
    if (search && !inst.client_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: installments.length,
    pending: installments.filter((i) => i.status === "pending").length,
    overdue: installments.filter((i) => i.status === "overdue").length,
    paid: installments.filter((i) => i.status === "paid").length,
    totalPending: installments
      .filter((i) => i.status === "pending" || i.status === "overdue")
      .reduce((acc, i) => acc + Number(i.amount), 0),
    totalOverdue: installments
      .filter((i) => i.status === "overdue")
      .reduce((acc, i) => acc + Number(i.amount), 0),
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cobranças Automatizadas</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie parcelas, marque pagamentos e envie cobranças via WhatsApp.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">R$ {stats.totalPending.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">Atrasadas</p>
          <p className="text-2xl font-bold text-destructive mt-1">{stats.overdue}</p>
          <p className="text-xs text-destructive/70">R$ {stats.totalOverdue.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Pagas</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.paid}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Parcelas</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          {([
            { key: "all", label: "Todas" },
            { key: "overdue", label: "Atrasadas" },
            { key: "pending", label: "Pendentes" },
            { key: "paid", label: "Pagas" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center py-12">
          <Receipt size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {installments.length === 0
              ? "Nenhuma parcela gerada. Cadastre um cliente com empréstimo para começar."
              : "Nenhuma parcela encontrada com este filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inst) => {
            const isOverdue = inst.status === "overdue";
            const isPaid = inst.status === "paid";
            return (
              <div
                key={inst.id}
                className={`rounded-lg border p-4 flex items-center justify-between gap-4 ${
                  isOverdue
                    ? "border-destructive/30 bg-destructive/5"
                    : isPaid
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground truncate">{inst.client_name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${
                      isOverdue
                        ? "bg-destructive/20 text-destructive"
                        : isPaid
                        ? "bg-green-500/20 text-green-400"
                        : "bg-accent text-muted-foreground"
                    }`}>
                      {isOverdue ? "Atrasada" : isPaid ? "Paga" : "Pendente"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Parcela {inst.installment_number} · R$ {Number(inst.amount).toFixed(2)} · Vencimento: {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                    {isPaid && inst.paid_at && ` · Pago em: ${new Date(inst.paid_at).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isPaid && (
                    <>
                      <button
                        onClick={() => handleWhatsApp(inst)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                        title="Cobrar via WhatsApp"
                      >
                        <MessageSquare size={14} />
                        Cobrar
                      </button>
                      <button
                        onClick={() => handleMarkPaid(inst.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-accent transition-colors"
                        title="Marcar como paga"
                      >
                        <Check size={14} />
                        Paga
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Cobrancas;
