import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Bot, Pause, Play, Search, Send, User, MessageCircle, Loader2 } from "lucide-react";
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
}

interface Message {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  sender: "client" | "bot" | "human";
  message_type: string;
  content: string | null;
  created_at: string;
}

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
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
        .limit(200);
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
        // reset unread
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
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [selectedId, user]);

  // Auto scroll
  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.contact_name || "").toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.last_message_preview || "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const send = async () => {
    if (!draft.trim() || !selected) return;
    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await supabase.functions.invoke("whatsapp-send", {
        body: { conversation_id: selected.id, text: draft.trim() },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      setDraft("");
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e?.message || "Falha", variant: "destructive" });
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
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: next ? "Bot pausado nesta conversa" : "Bot reativado" });
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] grid grid-cols-[340px_1fr] gap-3">
        {/* Lista */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <h2 className="font-semibold mb-2 flex items-center gap-2">
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
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                Nenhuma conversa ainda.
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-muted/40 transition ${
                  selectedId === c.id ? "bg-muted/60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {c.contact_name || c.phone}
                      </span>
                      {c.bot_paused && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          bot off
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.last_message_from === "bot" && "🤖 "}
                      {c.last_message_from === "human" && "👤 "}
                      {c.last_message_preview || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.last_message_at), {
                        addSuffix: false,
                        locale: ptBR,
                      })}
                    </span>
                    {c.unread_count > 0 && (
                      <Badge className="h-5 min-w-5 px-1.5 text-[10px]">
                        {c.unread_count}
                      </Badge>
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
              Selecione uma conversa para visualizar
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selected.contact_name || selected.phone}</h3>
                  <p className="text-xs text-muted-foreground">{selected.phone}</p>
                </div>
                <Button
                  size="sm"
                  variant={selected.bot_paused ? "default" : "outline"}
                  onClick={toggleBot}
                  className="gap-2"
                >
                  {selected.bot_paused ? (
                    <>
                      <Play className="h-3.5 w-3.5" /> Reativar bot
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Pausar bot
                    </>
                  )}
                </Button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/10">
                {loadingMsgs && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {messages.map((m) => {
                  const isOut = m.direction === "out";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isOut ? "justify-end" : "justify-start"}`}
                    >
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
                              <>
                                <Bot className="h-3 w-3" /> Bot IA
                              </>
                            ) : (
                              <>
                                <User className="h-3 w-3" /> Você
                              </>
                            )}
                          </div>
                        )}
                        <div>
                          {m.content || (
                            <em className="opacity-60">[{m.message_type}]</em>
                          )}
                        </div>
                        <div className="text-[9px] opacity-60 mt-0.5 text-right">
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && !loadingMsgs && (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    Sem mensagens
                  </div>
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
                  placeholder="Digite uma mensagem (Enter para enviar, Shift+Enter para nova linha)..."
                  rows={2}
                  className="resize-none"
                />
                <Button onClick={send} disabled={sending || !draft.trim()} className="self-end">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
