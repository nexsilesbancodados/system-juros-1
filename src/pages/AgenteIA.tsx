import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Bot, User, BarChart3, FileText, Wifi, WifiOff,
  QrCode, RefreshCw, LogOut, MessageSquare, Phone, CheckCircle2,
  Loader2, AlertTriangle, Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type ConnectionStatus = "checking" | "disconnected" | "qr_ready" | "connecting" | "connected" | "error";

const AgenteIA = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"chat" | "whatsapp" | "metricas" | "relatorios">("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou o assistente IA do System Juros. Posso ajudá-lo a consultar dados de clientes, parcelas, contratos e muito mais. Como posso ajudar?", timestamp: new Date() },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // WhatsApp state
  const [whatsappStatus, setWhatsappStatus] = useState<ConnectionStatus>("checking");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string>("");
  const [pollingQr, setPollingQr] = useState(false);
  const qrIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings-whatsapp", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("whatsapp_api_url, whatsapp_api_key, whatsapp_instance").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: dashData } = useQuery({
    queryKey: ["agent-context", user?.id],
    queryFn: async () => {
      const [contracts, installments, clients] = await Promise.all([
        supabase.from("contracts").select("*, clients(name)").eq("user_id", user!.id),
        supabase.from("contract_installments").select("*").eq("user_id", user!.id),
        supabase.from("clients").select("id, name, credit_score, status, phone, whatsapp").eq("user_id", user!.id),
      ]);
      return { contracts: contracts.data || [], installments: installments.data || [], clients: clients.data || [] };
    },
    enabled: !!user,
  });

  const callEvolutionApi = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sem sessão");

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...extra }),
      }
    );

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro na API");
    return data;
  }, []);

  // Check WhatsApp connection status on mount
  useEffect(() => {
    if (settings === undefined) return; // still loading
    checkStatus();
  }, [settings]);

  const checkStatus = async () => {
    setWhatsappStatus("checking");
    try {
      const data = await callEvolutionApi("check_status");
      setInstanceName(data.instance || "");
      if (data.status === "connected") {
        setWhatsappStatus("connected");
        setQrCode(null);
        stopPolling();
      } else {
        setWhatsappStatus("disconnected");
      }
    } catch {
      setWhatsappStatus("disconnected");
    }
  };

  const createInstance = async () => {
    setWhatsappStatus("connecting");
    try {
      const data = await callEvolutionApi("create_instance");
      setInstanceName(data.instance || "");
      if (data.status === "connected") {
        setWhatsappStatus("connected");
        toast({ title: "WhatsApp conectado!", description: "Instância já estava ativa." });
        return;
      }
      if (data.status === "qr_ready" && data.qrcode) {
        setQrCode(data.qrcode);
        setWhatsappStatus("qr_ready");
        startPolling();
        return;
      }
      // Need to fetch QR separately
      await fetchQr();
    } catch (err: any) {
      setWhatsappStatus("error");
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const fetchQr = async () => {
    try {
      const data = await callEvolutionApi("get_qr");
      if (data.qrcode) {
        setQrCode(data.qrcode);
        setWhatsappStatus("qr_ready");
        startPolling();
      } else {
        setWhatsappStatus("connecting");
        // Retry after 2s
        setTimeout(fetchQr, 2000);
      }
    } catch {
      setWhatsappStatus("error");
    }
  };

  const startPolling = () => {
    if (qrIntervalRef.current) return;
    setPollingQr(true);
    qrIntervalRef.current = setInterval(async () => {
      try {
        const data = await callEvolutionApi("check_status");
        if (data.status === "connected") {
          setWhatsappStatus("connected");
          setQrCode(null);
          stopPolling();
          toast({ title: "✅ WhatsApp Conectado!", description: "Instância pronta para uso." });
        }
      } catch {
        // Keep polling
      }
    }, 4000);
  };

  const stopPolling = () => {
    if (qrIntervalRef.current) {
      clearInterval(qrIntervalRef.current);
      qrIntervalRef.current = null;
    }
    setPollingQr(false);
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleLogout = async () => {
    try {
      await callEvolutionApi("logout");
      setWhatsappStatus("disconnected");
      setQrCode(null);
      toast({ title: "Desconectado", description: "WhatsApp desconectado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContext = () => {
    if (!dashData) return null;
    const { contracts, installments, clients } = dashData;
    const now = new Date();
    const overdueInstallments = installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now);
    const activeContracts = contracts.filter((c: any) => c.status === "active");
    const todayStr = now.toISOString().split("T")[0];
    const dueToday = installments.filter((i: any) => i.status === "pending" && i.due_date?.startsWith(todayStr));

    return {
      totalClients: clients.length,
      activeClients: clients.filter((c: any) => c.status === "Ativo").length,
      totalContracts: contracts.length,
      activeContracts: activeContracts.length,
      overdueCount: overdueInstallments.length,
      overdueAmount: overdueInstallments.reduce((s: number, i: any) => s + Number(i.amount), 0).toFixed(2),
      capitalOnStreet: activeContracts.reduce((s: number, c: any) => s + Number(c.capital), 0).toFixed(2),
      totalProfit: contracts.reduce((s: number, c: any) => s + Number(c.total_interest || 0), 0).toFixed(2),
      dueTodayCount: dueToday.length,
      clientsList: clients.slice(0, 20).map((c: any) => `- ${c.name} (Score: ${c.credit_score}, Status: ${c.status})`).join("\n"),
      overdueDetails: overdueInstallments.slice(0, 15).map((i: any) => `- Parcela ${i.installment_number}: R$ ${Number(i.amount).toFixed(2)} venc. ${new Date(i.due_date).toLocaleDateString("pt-BR")}`).join("\n"),
    };
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const context = buildContext();
    const apiMessages = updatedMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sem sessão");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: apiMessages, context }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || "Erro na API");
      }

      // Stream response
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent, timestamp: new Date() }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (!assistantContent) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Desculpe, não consegui processar sua pergunta. Tente novamente.", timestamp: new Date() }]);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ Erro: ${err.message}`, timestamp: new Date() }]);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const overdue = dashData?.installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now).length || 0;
  const totalConversas = messages.filter((m) => m.role === "user").length;

  

  const StatusBadge = () => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      checking: { color: "text-muted-foreground", icon: <Loader2 size={12} className="animate-spin" />, label: "Verificando..." },
      disconnected: { color: "text-orange-400", icon: <WifiOff size={12} />, label: "Desconectado" },
      qr_ready: { color: "text-blue-400", icon: <QrCode size={12} />, label: "Escaneie o QR" },
      connecting: { color: "text-yellow-400", icon: <Loader2 size={12} className="animate-spin" />, label: "Conectando..." },
      connected: { color: "text-green-400", icon: <Wifi size={12} />, label: "Conectado" },
      error: { color: "text-destructive", icon: <AlertTriangle size={12} />, label: "Não configurado" },
    };
    const cfg = statusConfig[whatsappStatus] || statusConfig.error;
    return (
      <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agente IA</h1>
          <p className="text-sm text-muted-foreground">Assistente inteligente com WhatsApp integrado</p>
        </div>
        <StatusBadge />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "chat" as const, label: "Chat", icon: <Bot size={16} /> },
          { id: "whatsapp" as const, label: "WhatsApp", icon: <Phone size={16} /> },
          { id: "metricas" as const, label: "Métricas", icon: <BarChart3 size={16} /> },
          { id: "relatorios" as const, label: "Relatórios", icon: <FileText size={16} /> },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            {t.icon} {t.label}
            {t.id === "whatsapp" && whatsappStatus === "connected" && <span className="w-2 h-2 rounded-full bg-green-400" />}
          </button>
        ))}
      </div>

      {/* WhatsApp Tab */}
      {tab === "whatsapp" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare size={20} /> Conexão WhatsApp
            </h2>
            {whatsappStatus === "connected" && (
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                <LogOut size={14} /> Desconectar
              </button>
            )}
          </div>

          {whatsappStatus === "connected" ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-green-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Instância: <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{instanceName}</span>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto mt-4">
                <div className="rounded-xl bg-muted/30 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{dashData?.clients.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                </div>
                <div className="rounded-xl bg-muted/30 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{overdue}</p>
                  <p className="text-xs text-muted-foreground">Atrasados</p>
                </div>
                <div className="rounded-xl bg-muted/30 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">Ativo</p>
                  <p className="text-xs text-muted-foreground">Status Bot</p>
                </div>
              </div>
            </div>
          ) : whatsappStatus === "qr_ready" && qrCode ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-foreground font-medium">Escaneie o QR Code com seu WhatsApp</p>
              <p className="text-xs text-muted-foreground">Abra o WhatsApp &gt; Menu &gt; Aparelhos conectados &gt; Conectar</p>
              <div className="inline-block p-4 bg-white rounded-2xl shadow-lg">
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 object-contain"
                />
              </div>
              {pollingQr && (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Aguardando leitura do QR Code...
                </p>
              )}
              <button
                onClick={fetchQr}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw size={14} /> Gerar novo QR
              </button>
            </div>
          ) : (
            <div className="text-center py-10 space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <QrCode size={36} className="text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">Conectar WhatsApp</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique abaixo para criar a instância e gerar o QR Code automaticamente.
                </p>
              </div>
              <button
                onClick={createInstance}
                disabled={whatsappStatus === "connecting" || whatsappStatus === "checking"}
                className="px-6 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {whatsappStatus === "connecting" || whatsappStatus === "checking" ? (
                  <><Loader2 size={16} className="animate-spin" /> Conectando...</>
                ) : (
                  <><Wifi size={16} /> Conectar WhatsApp</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chat Tab */}
      {tab === "chat" && (
        <div className="rounded-2xl border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 280px)" }}>
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

      {/* Metrics Tab */}
      {tab === "metricas" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Conversas", value: totalConversas },
            { label: "Mensagens", value: messages.length },
            { label: "Parcelas Atrasadas", value: overdue },
            { label: "WhatsApp", value: whatsappStatus === "connected" ? "✅ Online" : "❌ Offline" },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reports Tab */}
      {tab === "relatorios" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-4">Insights do Portfólio</h2>
          <div className="space-y-3">
            {[
              dashData && dashData.clients.length > 0 ? `Você gerencia ${dashData.clients.length} clientes e ${dashData.contracts.length} contratos.` : null,
              overdue > 0 ? `⚠️ Atenção: ${overdue} parcelas estão atrasadas e precisam de ação.` : "✅ Nenhuma parcela atrasada. Parabéns!",
              dashData ? `O capital total ativo é de R$ ${dashData.contracts.filter((c: any) => c.status === "active").reduce((s: number, c: any) => s + Number(c.capital), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` : null,
              whatsappStatus === "connected" ? "📱 WhatsApp conectado e pronto para envio de cobranças automáticas." : "📱 WhatsApp não conectado. Conecte para habilitar cobranças automáticas.",
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
