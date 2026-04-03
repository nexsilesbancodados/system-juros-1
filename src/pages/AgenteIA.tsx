import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Bot, User, BarChart3, FileText, Wifi, WifiOff,
  QrCode, RefreshCw, LogOut, MessageSquare, Phone, CheckCircle2,
  Loader2, AlertTriangle, Settings, Inbox, Reply, ChevronLeft,
  ToggleLeft, ToggleRight, Shield, Zap, Clock, Volume2, BellOff
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface WhatsAppChat {
  id: string;
  name?: string;
  remoteJid: string;
  phone?: string;
  lastMessage?: string;
  updatedAt?: string;
  unreadCount?: number;
}

interface WhatsAppMessageKey {
  id?: string;
  fromMe?: boolean;
  remoteJid?: string;
  remoteJidAlt?: string;
}

interface WhatsAppMsg {
  id?: string;
  key?: WhatsAppMessageKey;
  message?: Record<string, unknown>;
  messageTimestamp?: number;
  pushName?: string | null;
}

interface EvolutionChatRecord {
  id?: string | null;
  remoteJid?: string | null;
  pushName?: string | null;
  updatedAt?: string | null;
  unreadCount?: number | null;
  lastMessage?: {
    key?: WhatsAppMessageKey;
    message?: Record<string, unknown>;
    pushName?: string | null;
  };
}

type ConnectionStatus = "checking" | "disconnected" | "qr_ready" | "connecting" | "connected" | "error";
type TabType = "chat" | "whatsapp" | "mensagens" | "config" | "metricas" | "relatorios";
type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractWhatsAppText = (value: unknown, depth = 0): string => {
  if (depth > 6 || value == null) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractWhatsAppText(item, depth + 1);
      if (text) return text;
    }
    return "";
  }

  if (!isRecord(value)) {
    return "";
  }

  const directFields = [
    "conversation",
    "text",
    "caption",
    "contentText",
    "hydratedContentText",
    "displayText",
    "selectedDisplayText",
    "title",
    "description",
  ] as const;

  for (const field of directFields) {
    const candidate = value[field];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const nestedValue of Object.values(value)) {
    const text = extractWhatsAppText(nestedValue, depth + 1);
    if (text) return text;
  }

  return "";
};

const getJidLabel = (jid?: string | null) => (jid ? jid.split("@")[0] : undefined);

const getTimestampValue = (value?: string | number | null) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value) return new Date(value).getTime();
  return 0;
};

const getChatPhone = (chat: EvolutionChatRecord): string | undefined => {
  const candidates = [chat.lastMessage?.key?.remoteJidAlt, chat.remoteJid];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (candidate.endsWith("@s.whatsapp.net")) {
      const phone = candidate.replace(/\D/g, "");
      if (phone) return phone;
    }

    if (candidate.endsWith("@g.us") || candidate.endsWith("@lid")) {
      return candidate;
    }

    const phone = candidate.replace(/\D/g, "");
    if (phone) return phone;

    return candidate;
  }

  return undefined;
};

const getChatDisplayName = (chat: EvolutionChatRecord) =>
  chat.pushName?.trim() ||
  chat.lastMessage?.pushName?.trim() ||
  getJidLabel(chat.lastMessage?.key?.remoteJidAlt) ||
  getJidLabel(chat.remoteJid) ||
  "Conversa sem nome";

const AgenteIA = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou o assistente IA do System Juros. Como posso ajudar?", timestamp: new Date() },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // WhatsApp state
  const [whatsappStatus, setWhatsappStatus] = useState<ConnectionStatus>("checking");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string>("");
  const [pollingQr, setPollingQr] = useState(false);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Messages state
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [chatMessages, setChatMessages] = useState<WhatsAppMsg[]>([]);
  const [replyInput, setReplyInput] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Agent config state
  const [agentConfig, setAgentConfig] = useState({
    chatbotEnabled: true,
    autoCollections: true,
    autoReply: true,
    sendPix: true,
    notifyOwner: true,
    maxMessagesPerDay: 50,
    workHourStart: 8,
    workHourEnd: 20,
    tone: "formal" as "formal" | "casual" | "firme",
  });

  const { data: settings } = useQuery({
    queryKey: ["settings-agent", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("bot_enabled, bot_auto_send, bot_send_pix, bot_notify_owner, bot_max_messages_per_day, bot_send_hour, bot_send_minute, bot_tone, whatsapp_instance")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Sync config from DB
  useEffect(() => {
    if (settings) {
      setAgentConfig((prev) => ({
        ...prev,
        chatbotEnabled: settings.bot_enabled ?? true,
        autoCollections: settings.bot_auto_send ?? true,
        sendPix: settings.bot_send_pix ?? true,
        notifyOwner: settings.bot_notify_owner ?? true,
        maxMessagesPerDay: settings.bot_max_messages_per_day ?? 50,
        workHourStart: settings.bot_send_hour ?? 8,
        tone: (settings.bot_tone as any) ?? "formal",
      }));
    }
  }, [settings]);

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, ...extra }),
      }
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro na API");
    return data;
  }, []);

  // Check WhatsApp status
  useEffect(() => {
    if (settings === undefined) return;
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
        toast({ title: "WhatsApp conectado!" });
        return;
      }
      if (data.status === "qr_ready" && data.qrcode) {
        setQrCode(data.qrcode);
        setWhatsappStatus("qr_ready");
        startPolling();
        return;
      }
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
          toast({ title: "✅ WhatsApp Conectado!" });
        }
      } catch {}
    }, 4000);
  };

  const stopPolling = () => {
    if (qrIntervalRef.current) {
      clearInterval(qrIntervalRef.current);
      qrIntervalRef.current = null;
    }
    setPollingQr(false);
  };

  useEffect(() => () => stopPolling(), []);

  const handleLogout = async () => {
    try {
      await callEvolutionApi("logout");
      setWhatsappStatus("disconnected");
      setQrCode(null);
      toast({ title: "Desconectado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Fetch WhatsApp chats
  const loadChats = async () => {
    if (whatsappStatus !== "connected") return;

    setLoadingChats(true);
    try {
      const data = await callEvolutionApi("fetch_messages");
      const rawChats = Array.isArray(data.chats) ? (data.chats as EvolutionChatRecord[]) : [];
      const uniqueChats = new Map<string, WhatsAppChat>();

      rawChats.forEach((chat) => {
        const remoteJid = chat.remoteJid?.trim();
        if (!remoteJid || remoteJid === "status@broadcast") return;
        if (uniqueChats.has(remoteJid)) return;

        uniqueChats.set(remoteJid, {
          id: remoteJid,
          name: getChatDisplayName(chat),
          remoteJid,
          phone: getChatPhone(chat),
          lastMessage: extractWhatsAppText(chat.lastMessage?.message) || "[mídia]",
          updatedAt: chat.updatedAt || "",
          unreadCount: chat.unreadCount ?? 0,
        });
      });

      const chats = Array.from(uniqueChats.values()).sort(
        (a, b) => getTimestampValue(b.updatedAt) - getTimestampValue(a.updatedAt)
      );

      setWhatsappChats(chats);
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : "Erro ao carregar conversas";
      toast({ title: "Erro ao carregar chats", description, variant: "destructive" });
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    if (tab === "mensagens" && whatsappStatus === "connected") {
      loadChats();
    }
  }, [tab, whatsappStatus]);

  const openChat = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setLoadingMsgs(true);
    try {
      const data = await callEvolutionApi("fetch_messages", { remoteJid: chat.remoteJid, count: 30 });
      const nextMessages = (Array.isArray(data.messages) ? (data.messages as WhatsAppMsg[]) : []).sort(
        (a, b) => getTimestampValue(a.messageTimestamp) - getTimestampValue(b.messageTimestamp)
      );
      setChatMessages(nextMessages);
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : "Erro ao carregar mensagens";
      toast({ title: "Erro", description, variant: "destructive" });
    } finally {
      setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendReply = async () => {
    if (!replyInput.trim() || !selectedChat || sendingReply) return;
    setSendingReply(true);
    try {
      await callEvolutionApi("send_message", {
        phone: selectedChat.phone || selectedChat.remoteJid,
        message: replyInput,
      });
      setChatMessages((prev) => [
        ...prev,
        {
          key: { id: Date.now().toString(), fromMe: true, remoteJid: selectedChat.remoteJid },
          message: { conversation: replyInput },
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      ]);
      setReplyInput("");
      toast({ title: "Mensagem enviada!" });
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      toast({ title: "Erro ao enviar", description, variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  // Save agent config
  const saveConfig = async () => {
    if (!user) return;
    try {
      await supabase.from("settings").update({
        bot_enabled: agentConfig.chatbotEnabled,
        bot_auto_send: agentConfig.autoCollections,
        bot_send_pix: agentConfig.sendPix,
        bot_notify_owner: agentConfig.notifyOwner,
        bot_max_messages_per_day: agentConfig.maxMessagesPerDay,
        bot_send_hour: agentConfig.workHourStart,
        bot_tone: agentConfig.tone,
      }).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["settings-agent"] });
      toast({ title: "Configurações salvas!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
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
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: apiMessages, context }),
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || "Erro na API");
      }
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
        setMessages((prev) => [...prev, { role: "assistant", content: "Desculpe, não consegui processar. Tente novamente.", timestamp: new Date() }]);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ Erro: ${err.message}`, timestamp: new Date() }]);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const overdue = dashData?.installments.filter((i: any) => i.status === "pending" && new Date(i.due_date) < now).length || 0;

  const getMessageText = (msg: WhatsAppMsg) =>
    msg.message?.conversation || msg.message?.extendedTextMessage?.text || "[mídia]";

  const ToggleSwitch = ({ enabled, onToggle, label, description }: { enabled: boolean; onToggle: () => void; label: string; description: string }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button onClick={onToggle} className="shrink-0">
        {enabled ? (
          <ToggleRight size={32} className="text-primary" />
        ) : (
          <ToggleLeft size={32} className="text-muted-foreground" />
        )}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agente IA</h1>
          <p className="text-sm text-muted-foreground">Assistente inteligente com WhatsApp integrado</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${whatsappStatus === "connected" ? "text-green-500" : "text-muted-foreground"}`}>
          {whatsappStatus === "connected" ? <><Wifi size={12} /> Conectado</> : <><WifiOff size={12} /> Offline</>}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "chat", label: "Chat IA", icon: <Bot size={16} /> },
          { id: "mensagens", label: "Mensagens", icon: <Inbox size={16} /> },
          { id: "whatsapp", label: "WhatsApp", icon: <Phone size={16} /> },
          { id: "config", label: "Configurações", icon: <Settings size={16} /> },
          { id: "metricas", label: "Métricas", icon: <BarChart3 size={16} /> },
          { id: "relatorios", label: "Relatórios", icon: <FileText size={16} /> },
        ] as { id: TabType; label: string; icon: React.ReactNode }[]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ========== MENSAGENS TAB ========== */}
      {tab === "mensagens" && (
        <div className="rounded-2xl border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 280px)" }}>
          {whatsappStatus !== "connected" ? (
            <div className="flex-1 flex items-center justify-center text-center p-6">
              <div className="space-y-3">
                <WifiOff size={40} className="mx-auto text-muted-foreground" />
                <p className="text-foreground font-medium">WhatsApp não conectado</p>
                <p className="text-sm text-muted-foreground">Conecte na aba WhatsApp para ver as mensagens.</p>
              </div>
            </div>
          ) : !selectedChat ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><Inbox size={18} /> Conversas</h2>
                <button onClick={loadChats} disabled={loadingChats} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <RefreshCw size={16} className={`text-muted-foreground ${loadingChats ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingChats ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  </div>
                ) : whatsappChats.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    Nenhuma conversa encontrada
                  </div>
                ) : (
                  whatsappChats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => openChat(chat)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/50 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{chat.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{chat.lastMessage || "..."}</p>
                      </div>
                      {chat.unreadCount ? (
                        <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                          {chat.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center gap-3">
                <button onClick={() => { setSelectedChat(null); setChatMessages([]); }} className="p-1.5 rounded-lg hover:bg-muted/50">
                  <ChevronLeft size={18} className="text-foreground" />
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={14} className="text-primary" />
                </div>
                <p className="font-medium text-sm text-foreground">{selectedChat.name}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  chatMessages.map((msg, i) => {
                    const fromMe = msg.key?.fromMe;
                    const text = getMessageText(msg);
                    const time = msg.messageTimestamp
                      ? new Date(Number(msg.messageTimestamp) * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                      : "";
                    return (
                      <div key={i} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${fromMe ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground"}`}>
                          <p className="whitespace-pre-wrap">{text}</p>
                          <p className={`text-[10px] mt-0.5 ${fromMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{time}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatScrollRef} />
              </div>
              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <input
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendReply()}
                    placeholder="Digite sua resposta..."
                    className="flex-1 px-4 py-2.5 rounded-lg bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button onClick={sendReply} disabled={!replyInput.trim() || sendingReply} className="p-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                    {sendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== CONFIG TAB ========== */}
      {tab === "config" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3"><Bot size={18} /> Chatbot IA</h2>
            <ToggleSwitch
              enabled={agentConfig.chatbotEnabled}
              onToggle={() => setAgentConfig((p) => ({ ...p, chatbotEnabled: !p.chatbotEnabled }))}
              label="Chatbot Ativo"
              description="Responde mensagens automaticamente via IA no WhatsApp"
            />
            <ToggleSwitch
              enabled={agentConfig.autoReply}
              onToggle={() => setAgentConfig((p) => ({ ...p, autoReply: !p.autoReply }))}
              label="Resposta Automática"
              description="Responde automaticamente quando o cliente envia mensagem"
            />
            <div className="py-3">
              <p className="text-sm font-medium text-foreground mb-2">Tom das respostas</p>
              <div className="flex gap-2">
                {(["formal", "casual", "firme"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAgentConfig((p) => ({ ...p, tone: t }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${agentConfig.tone === t ? "bg-primary text-primary-foreground" : "bg-muted/30 border border-border text-muted-foreground"}`}
                  >
                    {t === "formal" ? "Formal" : t === "casual" ? "Casual" : "Firme"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3"><Zap size={18} /> Agente de Cobranças</h2>
            <ToggleSwitch
              enabled={agentConfig.autoCollections}
              onToggle={() => setAgentConfig((p) => ({ ...p, autoCollections: !p.autoCollections }))}
              label="Cobranças Automáticas"
              description="Envia mensagens de cobrança automaticamente para parcelas atrasadas"
            />
            <ToggleSwitch
              enabled={agentConfig.sendPix}
              onToggle={() => setAgentConfig((p) => ({ ...p, sendPix: !p.sendPix }))}
              label="Enviar Chave Pix"
              description="Inclui a chave Pix na mensagem de cobrança"
            />
            <ToggleSwitch
              enabled={agentConfig.notifyOwner}
              onToggle={() => setAgentConfig((p) => ({ ...p, notifyOwner: !p.notifyOwner }))}
              label="Notificar Proprietário"
              description="Receba uma notificação quando uma cobrança for enviada"
            />
            <div className="py-3">
              <label className="text-sm font-medium text-foreground block mb-2">Limite diário de mensagens</label>
              <input
                type="number"
                value={agentConfig.maxMessagesPerDay}
                onChange={(e) => setAgentConfig((p) => ({ ...p, maxMessagesPerDay: Number(e.target.value) }))}
                className="w-24 px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="py-3">
              <label className="text-sm font-medium text-foreground block mb-2 flex items-center gap-2">
                <Clock size={14} /> Horário de envio
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={agentConfig.workHourStart}
                  onChange={(e) => setAgentConfig((p) => ({ ...p, workHourStart: Number(e.target.value) }))}
                  className="w-16 px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground focus:outline-none"
                />
                <span className="text-sm text-muted-foreground">às</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={agentConfig.workHourEnd}
                  onChange={(e) => setAgentConfig((p) => ({ ...p, workHourEnd: Number(e.target.value) }))}
                  className="w-16 px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground focus:outline-none"
                />
                <span className="text-sm text-muted-foreground">horas</span>
              </div>
            </div>
          </div>

          <button
            onClick={saveConfig}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Salvar Configurações
          </button>
        </div>
      )}

      {/* ========== WHATSAPP TAB ========== */}
      {tab === "whatsapp" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><MessageSquare size={20} /> Conexão WhatsApp</h2>
            {whatsappStatus === "connected" && (
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                <LogOut size={14} /> Desconectar
              </button>
            )}
          </div>
          {whatsappStatus === "connected" ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-primary" />
              </div>
              <p className="text-lg font-semibold text-foreground">WhatsApp Conectado!</p>
              <p className="text-sm text-muted-foreground">Instância: <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{instanceName}</span></p>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mt-4">
                <div className="rounded-xl bg-muted/30 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{dashData?.clients.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                </div>
                <div className="rounded-xl bg-muted/30 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{overdue}</p>
                  <p className="text-xs text-muted-foreground">Atrasados</p>
                </div>
                <div className="rounded-xl bg-muted/30 border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-primary">Ativo</p>
                  <p className="text-xs text-muted-foreground">Status</p>
                </div>
              </div>
            </div>
          ) : whatsappStatus === "qr_ready" && qrCode ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-foreground font-medium">Escaneie o QR Code com seu WhatsApp</p>
              <div className="inline-block p-4 bg-white rounded-2xl shadow-lg">
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64 object-contain" />
              </div>
              {pollingQr && <p className="text-xs text-muted-foreground flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" /> Aguardando...</p>}
              <button onClick={fetchQr} className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground hover:bg-muted transition-colors"><RefreshCw size={14} /> Novo QR</button>
            </div>
          ) : (
            <div className="text-center py-10 space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"><QrCode size={36} className="text-primary" /></div>
              <p className="text-foreground font-medium">Conectar WhatsApp</p>
              <p className="text-sm text-muted-foreground">Crie a instância e gere o QR Code automaticamente.</p>
              <button onClick={createInstance} disabled={whatsappStatus === "connecting" || whatsappStatus === "checking"} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 mx-auto">
                {whatsappStatus === "connecting" || whatsappStatus === "checking" ? <><Loader2 size={16} className="animate-spin" /> Conectando...</> : <><Wifi size={16} /> Conectar WhatsApp</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========== CHAT IA TAB ========== */}
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
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Pergunte algo..." className="flex-1 px-4 py-2.5 rounded-lg bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              <button onClick={handleSend} disabled={!input.trim() || loading} className="p-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Send size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {tab === "metricas" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Conversas IA", value: messages.filter((m) => m.role === "user").length },
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

      {/* Reports */}
      {tab === "relatorios" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-4">Insights do Portfólio</h2>
          <div className="space-y-3">
            {[
              dashData && dashData.clients.length > 0 ? `Você gerencia ${dashData.clients.length} clientes e ${dashData.contracts.length} contratos.` : null,
              overdue > 0 ? `⚠️ ${overdue} parcelas atrasadas precisam de ação.` : "✅ Nenhuma parcela atrasada!",
              whatsappStatus === "connected" ? "📱 WhatsApp conectado e pronto." : "📱 WhatsApp não conectado.",
              agentConfig.chatbotEnabled ? "🤖 Chatbot IA ativo." : "🤖 Chatbot desativado.",
              agentConfig.autoCollections ? "⚡ Cobranças automáticas ativas." : "⚡ Cobranças automáticas desativadas.",
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
