import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  Bot, Pause, Play, Search, Send, User, MessageCircle, Loader2,
  AlertTriangle, Ban, FileText, Wallet, CheckCircle2, MoreVertical, Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  user_id: string;
  client_id: string | null;
  phone: string;
  jid: string;
  instance: string | null;
  contact_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_from: string | null;
  unread_count: number;
  bot_paused: boolean;
  needs_human: boolean;
  blocked: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  sender: "client" | "bot" | "human";
  message_type: string;
  content: string | null;
  created_at: string;
  metadata?: any;
}

interface Template {
  id: string;
  name: string;
  content: string;
}

type FilterKind = "all" | "unread" | "needs_human" | "bot" | "blocked";

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0, today: 0, needsHuman: 0, botReplies7d: 0, humanReplies7d: 0,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  // Load conversations + realtime
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false })
        .limit(300);
      if (mounted) setConversations((data as Conversation[]) || []);
    };
    load();

    const channel = supabase
      .channel("wa-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Load templates
  useEffect(() => {
    if (!user) return;
    supabase
      .from("message_templates")
      .select("id, name, content")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setTemplates((data as Template[]) || []));
  }, [user]);

  // Métricas (recalcula quando lista de conversas muda)
  useEffect(() => {
    if (!user) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const total = conversations.length;
    const todayCount = conversations.filter(c => new Date(c.last_message_at) >= today).length;
    const needsHuman = conversations.filter(c => c.needs_human).length;

    supabase
      .from("whatsapp_messages")
      .select("sender", { count: "exact", head: false })
      .eq("user_id", user.id)
      .eq("direction", "out")
      .gte("created_at", since7d)
      .then(({ data }) => {
        const bot = (data || []).filter((m: any) => m.sender === "bot").length;
        const human = (data || []).filter((m: any) => m.sender === "human").length;
        setMetrics({ total, today: todayCount, needsHuman, botReplies7d: bot, humanReplies7d: human });
      });
  }, [conversations, user]);

  // Load messages of selected + realtime
  useEffect(() => {
    if (!selectedId || !user) {
      setMessages([]);
      return;
    }
    let mounted = true;
    setLoadingMsgs(true);

    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (mounted) {
        setMessages((data as Message[]) || []);
        setLoadingMsgs(false);
        await supabase
          .from("whatsapp_conversations")
          .update({ unread_count: 0 })
          .eq("id", selectedId);
      }
    };
    load();

    const ch = supabase
      .channel(`wa-msg-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` },
        (payload) => setMessages((prev) => prev.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m))
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [selectedId, user]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter(c => {
      if (filter === "unread" && c.unread_count <= 0) return false;
      if (filter === "needs_human" && !c.needs_human) return false;
      if (filter === "bot" && c.bot_paused) return false;
      if (filter === "blocked" && !c.blocked) return false;
      if (!q) return true;
      return (c.contact_name || "").toLowerCase().includes(q)
        || c.phone.includes(q)
        || (c.last_message_preview || "").toLowerCase().includes(q);
    });
  }, [conversations, search, filter]);

  // === Helpers ===
  const invokeSend = async (payload: Record<string, any>) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const res = await supabase.functions.invoke("whatsapp-send", {
      body: payload,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.error) throw res.error;
  };

  const send = async () => {
    if (!draft.trim() || !selected) return;
    setSending(true);
    try {
      await invokeSend({ conversation_id: selected.id, text: draft.trim() });
      setDraft("");
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const quickAction = async (action: string, label: string) => {
    if (!selected) return;
    setSending(true);
    try {
      await invokeSend({ conversation_id: selected.id, action });
      toast({ title: label });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const toggleBot = async () => {
    if (!selected) return;
    const next = !selected.bot_paused;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ bot_paused: next })
      .eq("id", selected.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: next ? "Bot pausado nesta conversa" : "Bot reativado" });
  };

  const toggleBlock = async () => {
    if (!selected) return;
    const next = !selected.blocked;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ blocked: next, bot_paused: next || selected.bot_paused })
      .eq("id", selected.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: next ? "Contato bloqueado 🚫" : "Contato desbloqueado" });
  };

  const useTemplate = (tpl: Template) => {
    if (!selected) return;
    const name = (selected.contact_name || "").split(" ")[0] || "";
    const rendered = tpl.content.replaceAll("{nome}", name).replaceAll("{Nome}", name);
    setDraft(rendered);
  };

  return (
    <div className="space-y-3">
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Conversas" value={metrics.total} />
        <MetricCard label="Ativas hoje" value={metrics.today} />
        <MetricCard label="Precisam de você" value={metrics.needsHuman} accent="warning" />
        <MetricCard label="Bot (7d)" value={metrics.botReplies7d} accent="primary" />
        <MetricCard label="Humano (7d)" value={metrics.humanReplies7d} />
      </div>

      <div className="h-[calc(100vh-14rem)] grid grid-cols-[340px_1fr] gap-3">
        {/* Lista */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Conversas
            </h2>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-9"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {([
                ["all", "Todas"],
                ["unread", "Não lidas"],
                ["needs_human", "🆘"],
                ["bot", "Bot on"],
                ["blocked", "🚫"],
              ] as [FilterKind, string][]).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                    filter === k
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted/40"
                  }`}
                >{l}</button>
              ))}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">Nada por aqui.</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-muted/40 transition ${
                  selectedId === c.id ? "bg-muted/60" : ""
                } ${c.needs_human ? "border-l-2 border-l-destructive" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{c.contact_name || c.phone}</span>
                      {c.needs_human && (
                        <Badge variant="destructive" className="text-[9px] py-0 h-4 px-1.5">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />humano
                        </Badge>
                      )}
                      {c.bot_paused && !c.blocked && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 px-1.5">bot off</Badge>
                      )}
                      {c.blocked && (
                        <Badge variant="secondary" className="text-[9px] py-0 h-4 px-1.5">🚫</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.last_message_from === "bot" && "🤖 "}
                      {c.last_message_from === "human" && "👤 "}
                      {c.last_message_preview || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: ptBR })}
                    </span>
                    {c.unread_count > 0 && (
                      <Badge className="h-5 min-w-5 px-1.5 text-[10px]">{c.unread_count}</Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* Chat */}
        <Card className="flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{selected.contact_name || selected.phone}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selected.phone}
                    {selected.needs_human && <span className="ml-2 text-destructive font-medium">• precisa de atendimento</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={selected.bot_paused ? "default" : "outline"}
                    onClick={toggleBot}
                    className="gap-1.5 h-8"
                  >
                    {selected.bot_paused
                      ? (<><Play className="h-3.5 w-3.5" />Reativar bot</>)
                      : (<><Pause className="h-3.5 w-3.5" />Pausar bot</>)}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      {selected.needs_human && (
                        <DropdownMenuItem onClick={() => quickAction("mark_resolved", "Marcado como resolvido")}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />Marcar como resolvido
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={toggleBlock}>
                        <Ban className="h-4 w-4 mr-2" />
                        {selected.blocked ? "Desbloquear contato" : "Bloquear contato"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/10">
                {loadingMsgs && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {messages.map((m) => {
                  const isOut = m.direction === "out";
                  const isFollowup = m.metadata?.followup;
                  return (
                    <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                          isOut
                            ? m.sender === "bot"
                              ? "bg-primary/15 text-foreground"
                              : "bg-primary text-primary-foreground"
                            : "bg-card border border-border"
                        }`}
                      >
                        {isOut && (
                          <div className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                            {m.sender === "bot" ? (
                              <><Bot className="h-3 w-3" /> Bot IA{isFollowup && " • follow-up"}</>
                            ) : (
                              <><User className="h-3 w-3" /> Você</>
                            )}
                          </div>
                        )}
                        <div>
                          {m.content || <em className="opacity-60">[{m.message_type}]</em>}
                        </div>
                        <div className="text-[9px] opacity-60 mt-0.5 text-right">
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && !loadingMsgs && (
                  <div className="text-center text-xs text-muted-foreground py-8">Sem mensagens</div>
                )}
              </div>

              {/* Quick actions */}
              <div className="px-3 pt-2 flex gap-1.5 flex-wrap border-t border-border">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => quickAction("send_pix", "Chave PIX enviada")}>
                  <Wallet className="h-3 w-3" />Enviar PIX
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => quickAction("send_receipt_request", "Pedido enviado")}>
                  <FileText className="h-3 w-3" />Pedir comprovante
                </Button>
                {templates.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Sparkles className="h-3 w-3" />Templates
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-w-xs">
                      <DropdownMenuLabel>Inserir template</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {templates.map(t => (
                        <DropdownMenuItem key={t.id} onClick={() => useTemplate(t)} className="flex-col items-start">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">{t.content}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="p-3 border-t border-border flex gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={selected.blocked ? "Contato bloqueado — desbloqueie para enviar" : "Digite uma mensagem (Enter pra enviar, Shift+Enter nova linha)..."}
                  rows={2}
                  className="resize-none"
                  disabled={selected.blocked}
                />
                <Button onClick={send} disabled={sending || !draft.trim() || selected.blocked} className="self-end">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, accent,
}: { label: string; value: number; accent?: "warning" | "primary" }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${
        accent === "warning" && value > 0 ? "text-destructive" :
        accent === "primary" ? "text-primary" : ""
      }`}>{value}</p>
    </Card>
  );
}
