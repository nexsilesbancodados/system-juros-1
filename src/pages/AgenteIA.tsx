import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Send, Bot, User, BarChart3, FileText } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const AgenteIA = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"chat" | "metricas" | "relatorios">("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou o assistente IA do Urus Jurista. Posso ajudá-lo a consultar dados de clientes, parcelas, contratos e muito mais. Como posso ajudar?", timestamp: new Date() },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: dashData } = useQuery({
    queryKey: ["agent-context", user?.id],
    queryFn: async () => {
      const [contracts, installments, clients] = await Promise.all([
        supabase.from("contracts").select("*, clients(name)").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*").eq("user_id", user!.id),
        supabase.from("clients").select("id, name, credit_score, status").eq("user_id", user!.id),
      ]);
      return { contracts: contracts.data || [], installments: installments.data || [], clients: clients.data || [] };
    },
    enabled: !!user,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const processQuery = (query: string): string => {
    if (!dashData) return "Ainda carregando dados...";
    const q = query.toLowerCase();
    const { contracts, installments, clients } = dashData;
    const now = new Date();

    if (q.includes("quantos clientes") || q.includes("total de clientes")) {
      return `Você tem **${clients.length}** clientes cadastrados. ${clients.filter((c: any) => c.status === "Ativo").length} ativos.`;
    }
    if (q.includes("quantos contratos") || q.includes("total de contratos")) {
      const active = contracts.filter((c: any) => c.status === "active").length;
      return `Você tem **${contracts.length}** contratos no total, sendo **${active}** ativos.`;
    }
    if (q.includes("inadimpl") || q.includes("atraso") || q.includes("atrasad")) {
      const overdue = installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now);
      const total = overdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
      return `Há **${overdue.length}** parcelas atrasadas, totalizando **R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}**.`;
    }
    if (q.includes("capital") || q.includes("emprestado")) {
      const capital = contracts.filter((c: any) => c.status === "active" || c.status === "overdue").reduce((s: number, c: any) => s + Number(c.capital), 0);
      return `O capital na rua (emprestado em contratos ativos) é de **R$ ${capital.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}**.`;
    }
    if (q.includes("lucro") || q.includes("juros")) {
      const lucro = contracts.reduce((s: number, c: any) => s + Number(c.total_interest || 0), 0);
      return `O total de juros/lucro dos contratos é **R$ ${lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}**.`;
    }
    if (q.includes("parcela") && (q.includes("hoje") || q.includes("vence"))) {
      const todayStr = now.toISOString().split("T")[0];
      const today = installments.filter((i: any) => i.status === "pending" && i.due_date.startsWith(todayStr));
      return today.length > 0 ? `Há **${today.length}** parcelas vencendo hoje.` : "Nenhuma parcela vence hoje.";
    }
    if (q.includes("cliente") && (q.includes("busca") || q.includes("procur"))) {
      const name = q.replace(/.*?(buscar|procurar|encontrar)\s*/i, "").trim();
      const found = clients.filter((c: any) => c.name?.toLowerCase().includes(name));
      if (found.length > 0) return `Encontrei ${found.length} cliente(s): ${found.map((c: any) => `**${c.name}** (Score: ${c.credit_score})`).join(", ")}`;
      return `Nenhum cliente encontrado com "${name}".`;
    }
    return "Entendi sua pergunta! Posso responder sobre:\n- **Clientes** (quantos, buscar por nome)\n- **Contratos** (quantos, ativos)\n- **Parcelas** (atrasadas, vencendo hoje)\n- **Capital na rua**\n- **Lucros/Juros**\n\nTente perguntar algo como: \"Quantos contratos ativos?\" ou \"Qual o capital na rua?\"";
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const response = processQuery(userMsg.content);
      setMessages((prev) => [...prev, { role: "assistant", content: response, timestamp: new Date() }]);
      setLoading(false);
    }, 500);
  };

  const now = new Date();
  const overdue = dashData?.installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now).length || 0;
  const totalConversas = messages.filter((m) => m.role === "user").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agente IA</h1>
        <p className="text-sm text-muted-foreground">Assistente inteligente do Urus Jurista</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "chat" as const, label: "Chat", icon: <Bot size={16} /> },
          { id: "metricas" as const, label: "Métricas", icon: <BarChart3 size={16} /> },
          { id: "relatorios" as const, label: "Relatórios", icon: <FileText size={16} /> },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <div className="rounded-xl border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 280px)" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "assistant" ? "bg-primary/10" : "bg-accent"}`}>
                  {msg.role === "assistant" ? <Bot size={16} className="text-primary" /> : <User size={16} className="text-foreground" />}
                </div>
                <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${msg.role === "assistant" ? "bg-muted/50 text-foreground" : "bg-primary text-primary-foreground"}`}>
                  <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
                  <p className={`text-[10px] mt-1 ${msg.role === "assistant" ? "text-muted-foreground" : "text-primary-foreground/60"}`}>
                    {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot size={16} className="text-primary" /></div>
                <div className="bg-muted/50 rounded-xl px-4 py-3 text-sm text-muted-foreground">Pensando...</div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Pergunte algo... Ex: Quantos contratos ativos?"
                className="flex-1 px-4 py-2.5 rounded-lg bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button onClick={handleSend} disabled={!input.trim() || loading} className="p-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "metricas" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Conversas", value: totalConversas },
            { label: "Mensagens", value: messages.length },
            { label: "Parcelas Atrasadas", value: overdue },
            { label: "Clientes", value: dashData?.clients.length || 0 },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "relatorios" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-4">Insights do Portfólio</h2>
          <div className="space-y-3">
            {[
              dashData && dashData.clients.length > 0 ? `Você gerencia ${dashData.clients.length} clientes e ${dashData.contracts.length} contratos.` : null,
              overdue > 0 ? `⚠️ Atenção: ${overdue} parcelas estão atrasadas e precisam de ação.` : "✅ Nenhuma parcela atrasada. Parabéns!",
              dashData ? `O capital total ativo é de R$ ${dashData.contracts.filter((c: any) => c.status === "active").reduce((s: number, c: any) => s + Number(c.capital), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` : null,
            ].filter(Boolean).map((insight, i) => (
              <div key={i} className="px-4 py-3 rounded-lg bg-muted/30 border border-border text-sm text-foreground">{insight}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgenteIA;
