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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import {
  Bot, Pause, Play, Search, Send, User, MessageCircle, Loader2,
  AlertTriangle, Ban, FileText, Wallet, CheckCircle2, MoreVertical, Sparkles,
  Tag as TagIcon, StickyNote, Clock, Paperclip, Download, BarChart3, Wand2, X, Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSignedUploadUrl } from "@/lib/storage";

interface Conversation {
  id: string; user_id: string; client_id: string | null;
  phone: string; jid: string; instance: string | null;
  contact_name: string | null; last_message_at: string;
  last_message_preview: string | null; last_message_from: string | null;
  unread_count: number; bot_paused: boolean; needs_human: boolean;
  blocked: boolean; tags: string[] | null; last_intent: string | null;
  bot_status?: string | null; human_takeover_at?: string | null; human_takeover_reason?: string | null;
}

interface Message {
  id: string; conversation_id: string;
  direction: "in" | "out"; sender: "client" | "bot" | "human";
  message_type: string; content: string | null; created_at: string;
  media_url?: string | null; metadata?: any;
}

interface Template { id: string; name: string; content: string; }
interface Note { id: string; content: string; created_at: string; author_name?: string | null; }

type FilterKind = "all" | "unread" | "needs_human" | "bot" | "blocked";

const INTENT_LABEL: Record<string, { label: string; color: string }> = {
  pagamento: { label: "💰 Pagamento", color: "bg-green-500/20 text-green-700 dark:text-green-300" },
  duvida: { label: "❓ Dúvida", color: "bg-blue-500/20 text-blue-700 dark:text-blue-300" },
  reclamacao: { label: "😤 Reclamação", color: "bg-red-500/20 text-red-700 dark:text-red-300" },
  negociacao: { label: "🤝 Negociação", color: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  comprovante: { label: "📄 Comprovante", color: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" },
  saudacao: { label: "👋 Saudação", color: "bg-violet-500/20 text-violet-700 dark:text-violet-300" },
  agressivo: { label: "⚠️ Agressivo", color: "bg-red-600/30 text-red-700 dark:text-red-200" },
};

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiSummary, setAiSummary] = useState<{ summary: string; key_points: string[]; next_action: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [hourlyStats, setHourlyStats] = useState<{ hour: number; count: number }[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0, today: 0, needsHuman: 0, botReplies7d: 0, humanReplies7d: 0,
  });
  const [actionsOpen, setActionsOpen] = useState(false);
  const [botActions, setBotActions] = useState<Array<{ id: string; tool_name: string; tool_input: any; tool_output: any; success: boolean; created_at: string }>>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const openBotActions = async () => {
    if (!selected) return;
    setActionsOpen(true);
    setActionsLoading(true);
    const { data } = await supabase
      .from("bot_actions_log")
      .select("id, tool_name, tool_input, tool_output, success, created_at")
      .eq("conversation_id", selected.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setBotActions((data || []) as any);
    setActionsLoading(false);
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  // === Load conversations + realtime ===
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_conversations").select("*")
        .eq("user_id", user.id).order("last_message_at", { ascending: false }).limit(300);
      if (mounted) setConversations((data as Conversation[]) || []);
    };
    load();
    const channel = supabase
      .channel("wa-conversations")
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "whatsapp_conversations", filter: `user_id=eq.${user.id}` },
        () => load()
      ).subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [user]);

  // === Templates ===
  useEffect(() => {
    if (!user) return;
    supabase.from("message_templates")
      .select("id, name, content").eq("user_id", user.id)
      .eq("is_active", true).order("name")
      .then(({ data }) => setTemplates((data as Template[]) || []));
  }, [user]);

  // === Métricas ===
  useEffect(() => {
    if (!user) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const total = conversations.length;
    const todayCount = conversations.filter(c => new Date(c.last_message_at) >= today).length;
    const needsHuman = conversations.filter(c => c.needs_human).length;
    supabase.from("whatsapp_messages")
      .select("sender, created_at").eq("user_id", user.id)
      .eq("direction", "out").gte("created_at", since7d)
      .then(({ data }) => {
        const bot = (data || []).filter((m: any) => m.sender === "bot").length;
        const human = (data || []).filter((m: any) => m.sender === "human").length;
        setMetrics({ total, today: todayCount, needsHuman, botReplies7d: bot, humanReplies7d: human });
      });
  }, [conversations, user]);

  // === Messages + notes para conversa selecionada ===
  useEffect(() => {
    if (!selectedId || !user) { setMessages([]); setNotes([]); return; }
    let mounted = true;
    setLoadingMsgs(true);

    const load = async () => {
      const [{ data: msgs }, { data: nts }] = await Promise.all([
        supabase.from("whatsapp_messages").select("*")
          .eq("conversation_id", selectedId).order("created_at", { ascending: true }).limit(500),
        supabase.from("whatsapp_notes").select("*")
          .eq("conversation_id", selectedId).order("created_at", { ascending: false }),
      ]);
      if (!mounted) return;
      setMessages((msgs as Message[]) || []);
      setNotes((nts as Note[]) || []);
      setLoadingMsgs(false);
      await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", selectedId);
    };
    load();

    const ch = supabase
      .channel(`wa-msg-${selectedId}`)
      .on("postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` },
        (p) => setMessages(prev => [...prev, p.new as Message]))
      .on("postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` },
        (p) => setMessages(prev => prev.map(m => m.id === (p.new as Message).id ? p.new as Message : m)))
      .subscribe();

    setAiSuggestions(null); setAiSummary(null);
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [selectedId, user]);

  // Scroll automático
  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length, selectedId]);

  // === KEYBOARD SHORTCUTS ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Não interfere em inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      // Navegação ↑/↓
      if (!isInput && (e.key === "ArrowUp" || e.key === "ArrowDown") && filtered.length) {
        e.preventDefault();
        const idx = filtered.findIndex(c => c.id === selectedId);
        const next = e.key === "ArrowDown"
          ? Math.min(idx + 1, filtered.length - 1)
          : Math.max(idx - 1, 0);
        setSelectedId(filtered[next < 0 ? 0 : next].id);
      }
      // Ctrl+Enter envia
      if (e.ctrlKey && e.key === "Enter" && draft.trim() && selected) {
        e.preventDefault(); send();
      }
      // Ctrl+P pausa bot
      if (e.ctrlKey && e.key.toLowerCase() === "p" && selected) {
        e.preventDefault(); toggleBot();
      }
      // Ctrl+R resolve
      if (e.ctrlKey && e.key.toLowerCase() === "r" && selected) {
        e.preventDefault(); quickAction("mark_resolved", "Resolvido");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, conversations, search, filter, draft]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter(c => {
      if (filter === "unread" && c.unread_count <= 0) return false;
      if (filter === "needs_human" && c.bot_status !== "handoff" && !c.needs_human) return false;
      if (filter === "bot" && c.bot_paused) return false;
      if (filter === "blocked" && !c.blocked) return false;
      if (!q) return true;
      return (c.contact_name || "").toLowerCase().includes(q)
        || c.phone.includes(q)
        || (c.last_message_preview || "").toLowerCase().includes(q)
        || (c.tags || []).some(t => t.toLowerCase().includes(q));
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
      setDraft(""); setAiSuggestions(null);
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e?.message || "Falha", variant: "destructive" });
    } finally { setSending(false); }
  };

  const quickAction = async (action: string, label: string) => {
    if (!selected) return;
    setSending(true);
    try {
      await invokeSend({ conversation_id: selected.id, action });
      toast({ title: label });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha", variant: "destructive" });
    } finally { setSending(false); }
  };

  const toggleBot = async () => {
    if (!selected) return;
    const next = !selected.bot_paused;
    const patch: any = { bot_paused: next };
    // Ao reativar, limpa qualquer handoff pendente
    if (!next) {
      patch.bot_status = "active";
      patch.needs_human = false;
      patch.human_takeover_at = null;
      patch.human_takeover_reason = null;
    } else {
      patch.bot_status = "paused";
    }
    const { error } = await supabase.from("whatsapp_conversations").update(patch).eq("id", selected.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: next ? "Bot pausado" : "Bot reativado — handoff limpo" });
  };

  const toggleBlock = async () => {
    if (!selected) return;
    const next = !selected.blocked;
    const { error } = await supabase.from("whatsapp_conversations")
      .update({ blocked: next, bot_paused: next || selected.bot_paused }).eq("id", selected.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: next ? "Bloqueado 🚫" : "Desbloqueado" });
  };

  const useTemplate = (tpl: Template) => {
    if (!selected) return;
    const name = (selected.contact_name || "").split(" ")[0] || "";
    setDraft(tpl.content.replace(/\{nome\}/gi, name));
  };

  // === Tags ===
  const addTag = async () => {
    if (!selected || !newTag.trim()) return;
    const tags = Array.from(new Set([...(selected.tags || []), newTag.trim()]));
    await supabase.from("whatsapp_conversations").update({ tags }).eq("id", selected.id);
    setNewTag("");
  };
  const removeTag = async (t: string) => {
    if (!selected) return;
    const tags = (selected.tags || []).filter(x => x !== t);
    await supabase.from("whatsapp_conversations").update({ tags }).eq("id", selected.id);
  };

  // === Notes ===
  const addNote = async () => {
    if (!selected || !newNote.trim() || !user) return;
    await supabase.from("whatsapp_notes").insert({
      conversation_id: selected.id, user_id: user.id,
      content: newNote.trim(), author_name: user.email,
    });
    setNewNote("");
    const { data } = await supabase.from("whatsapp_notes").select("*")
      .eq("conversation_id", selected.id).order("created_at", { ascending: false });
    setNotes((data as Note[]) || []);
  };

  // === Mídia ===
  const onFileSelected = async (file: File) => {
    if (!selected || !user) return;
    setSending(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/whatsapp/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const publicUrl = await getSignedUploadUrl(path);
      if (!publicUrl) throw new Error("Falha ao gerar URL do arquivo");
      const type: "image" | "document" | "audio" =
        file.type.startsWith("image/") ? "image"
        : file.type.startsWith("audio/") ? "audio"
        : "document";
      await invokeSend({
        conversation_id: selected.id,
        media_url: publicUrl, media_type: type,
        caption: draft.trim() || undefined,
      });
      setDraft("");
      toast({ title: "Mídia enviada" });
    } catch (e: any) {
      toast({ title: "Erro mídia", description: e?.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  // === Agendamento ===
  const scheduleSend = async () => {
    if (!selected || !scheduleText.trim() || !scheduleDate || !scheduleTime) return;
    const iso = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    setSending(true);
    try {
      await invokeSend({ conversation_id: selected.id, text: scheduleText.trim(), schedule_for: iso });
      toast({ title: "Mensagem agendada" });
      setScheduleOpen(false); setScheduleText(""); setScheduleDate(""); setScheduleTime("");
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  // === IA ===
  const aiCall = async (mode: "suggest" | "summarize") => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("whatsapp-ai-assist", {
        body: { conversation_id: selected.id, mode },
        headers: { Authorization: `Bearer ${sess.session?.access_token}` },
      });
      if (res.error) throw res.error;
      if (mode === "suggest") setAiSuggestions(res.data?.suggestions || []);
      if (mode === "summarize") setAiSummary({
        summary: res.data?.summary || "",
        key_points: res.data?.key_points || [],
        next_action: res.data?.next_action || "",
      });
    } catch (e: any) {
      toast({ title: "Erro IA", description: e?.message, variant: "destructive" });
    } finally { setAiLoading(false); }
  };

  // === Export ===
  const exportConversation = () => {
    if (!selected) return;
    const lines = [
      `Conversa com ${selected.contact_name || selected.phone}`,
      `Exportado em ${new Date().toLocaleString("pt-BR")}`,
      "─".repeat(60), "",
    ];
    messages.forEach(m => {
      const who = m.direction === "in" ? "CLIENTE" : (m.sender === "bot" ? "BOT" : "OPERADOR");
      const ts = new Date(m.created_at).toLocaleString("pt-BR");
      lines.push(`[${ts}] ${who}: ${m.content || `[${m.message_type}]`}`);
    });
    if (notes.length) {
      lines.push("", "─".repeat(60), "NOTAS INTERNAS", "");
      notes.forEach(n => lines.push(`[${new Date(n.created_at).toLocaleString("pt-BR")}] ${n.content}`));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `conversa-${selected.phone}-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // === Métricas avançadas (modal) ===
  const loadAdvancedMetrics = async () => {
    if (!user) return;
    setMetricsOpen(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from("whatsapp_messages")
      .select("created_at").eq("user_id", user.id)
      .eq("direction", "in").gte("created_at", since);
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    (data || []).forEach((m: any) => {
      const h = new Date(m.created_at).getHours();
      buckets[h].count++;
    });
    setHourlyStats(buckets);
  };

  const maxHourly = Math.max(1, ...hourlyStats.map(h => h.count));

  return (
    <div className="space-y-3">
      {/* Métricas resumidas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard label="Conversas" value={metrics.total} />
        <MetricCard label="Ativas hoje" value={metrics.today} />
        <MetricCard label="Precisam de você" value={metrics.needsHuman} accent="warning" />
        <MetricCard label="Bot (7d)" value={metrics.botReplies7d} accent="primary" />
        <MetricCard label="Humano (7d)" value={metrics.humanReplies7d} />
        <Card className="p-3 flex flex-col justify-between cursor-pointer hover:bg-muted/40 transition" onClick={loadAdvancedMetrics}>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Avançado</p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Ver gráfico</p>
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
        </Card>
      </div>

      <div className="h-[calc(100vh-14rem)] grid grid-cols-[340px_1fr] gap-3">
        {/* Lista de conversas */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Conversas
              <span className="ml-auto text-[10px] text-muted-foreground font-normal">↑↓ navega</span>
            </h2>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar (nome, tag, msg)..." className="pl-8 h-9" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {([
                ["all", "Todas"], ["unread", "Não lidas"], ["needs_human", "🆘"],
                ["bot", "Bot on"], ["blocked", "🚫"],
              ] as [FilterKind, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                    filter === k ? "bg-primary text-primary-foreground border-primary"
                                 : "border-border hover:bg-muted/40"}`}>{l}</button>
              ))}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">Nada por aqui.</div>
            )}
            {filtered.map((c) => {
              const intentBadge = c.last_intent && INTENT_LABEL[c.last_intent];
              return (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-muted/40 transition ${
                    selectedId === c.id ? "bg-muted/60" : ""
                  } ${c.needs_human ? "border-l-2 border-l-destructive" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium truncate">{c.contact_name || c.phone}</span>
                        {c.bot_status === "handoff" && (
                          <Badge variant="destructive" className="text-[9px] py-0 h-4 px-1.5 animate-pulse">
                            🚨 humano
                          </Badge>
                        )}
                        {c.bot_status !== "handoff" && c.needs_human && (
                          <Badge variant="destructive" className="text-[9px] py-0 h-4 px-1.5">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />humano
                          </Badge>
                        )}
                        {c.bot_paused && c.bot_status !== "handoff" && !c.blocked && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4 px-1.5">bot off</Badge>
                        )}
                        {c.blocked && (
                          <Badge variant="secondary" className="text-[9px] py-0 h-4 px-1.5">🚫</Badge>
                        )}
                      </div>
                      {(c.tags?.length || intentBadge) && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {intentBadge && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${intentBadge.color}`}>
                              {intentBadge.label}
                            </span>
                          )}
                          {(c.tags || []).slice(0, 3).map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
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
              );
            })}
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
              {/* Header */}
              <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{selected.contact_name || selected.phone}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>{selected.phone}</span>
                    {selected.bot_status === "handoff" && (
                      <span className="text-destructive font-medium">🚨 aguardando atendente humano{selected.human_takeover_reason ? ` — ${selected.human_takeover_reason}` : ""}</span>
                    )}
                    {selected.bot_status !== "handoff" && selected.needs_human && <span className="text-destructive font-medium">• precisa de atendimento</span>}
                    {(selected.tags || []).map(t => (
                      <span key={t} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-1.5 rounded-full">
                        #{t}
                        <button onClick={() => removeTag(t)} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant={selected.bot_status === "handoff" ? "destructive" : (selected.bot_paused ? "default" : "outline")}
                    onClick={toggleBot} className="gap-1.5 h-8" title="Ctrl+P">
                    {selected.bot_status === "handoff"
                      ? (<><Play className="h-3.5 w-3.5" />Reassumir bot</>)
                      : selected.bot_paused
                        ? (<><Play className="h-3.5 w-3.5" />Reativar</>)
                        : (<><Pause className="h-3.5 w-3.5" />Pausar</>)}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Ações do bot" onClick={openBotActions}>
                    <Activity className="h-4 w-4" />
                  </Button>
                  <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Tags">
                        <TagIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 space-y-2">
                      <p className="text-xs font-medium">Etiquetas</p>
                      <div className="flex flex-wrap gap-1">
                        {(selected.tags || []).map(t => (
                          <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            #{t}
                            <button onClick={() => removeTag(t)}><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                        {!(selected.tags?.length) && <span className="text-xs text-muted-foreground">Sem etiquetas</span>}
                      </div>
                      <div className="flex gap-1">
                        <Input value={newTag} onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addTag()}
                          placeholder="Nova etiqueta" className="h-8 text-xs" />
                        <Button size="sm" className="h-8" onClick={addTag}>+</Button>
                      </div>
                      <div className="flex gap-1 flex-wrap pt-1">
                        {["VIP", "Inadimplente", "Negociação", "Quitado"].map(t => (
                          <button key={t} onClick={() => { setNewTag(t); setTimeout(addTag, 0); }}
                            className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-muted">+ {t}</button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 relative"
                    onClick={() => setNotesOpen(true)} title="Notas internas">
                    <StickyNote className="h-4 w-4" />
                    {notes.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">{notes.length}</span>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      {selected.needs_human && (
                        <DropdownMenuItem onClick={() => quickAction("mark_resolved", "Resolvido")}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />Marcar como resolvido <span className="ml-auto text-[10px] opacity-60">Ctrl+R</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setScheduleOpen(true)}>
                        <Clock className="h-4 w-4 mr-2" />Agendar mensagem
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportConversation}>
                        <Download className="h-4 w-4 mr-2" />Exportar conversa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={toggleBlock}>
                        <Ban className="h-4 w-4 mr-2" />
                        {selected.blocked ? "Desbloquear" : "Bloquear contato"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/10">
                {loadingMsgs && (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                )}
                {messages.map((m) => {
                  const isOut = m.direction === "out";
                  const isFollowup = m.metadata?.followup;
                  const isScheduled = m.metadata?.scheduled;
                  return (
                    <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                        isOut
                          ? m.sender === "bot" ? "bg-primary/15 text-foreground" : "bg-primary text-primary-foreground"
                          : "bg-card border border-border"}`}>
                        {isOut && (
                          <div className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                            {m.sender === "bot"
                              ? (<><Bot className="h-3 w-3" /> Bot IA{isFollowup && " • follow-up"}</>)
                              : (<><User className="h-3 w-3" /> Você{isScheduled && " • agendada"}</>)}
                          </div>
                        )}
                        {m.media_url && m.message_type === "image" && (
                          <img src={m.media_url} alt="" className="rounded mb-1 max-h-60" />
                        )}
                        {m.media_url && m.message_type !== "image" && (
                          <a href={m.media_url} target="_blank" rel="noreferrer" className="text-xs underline mb-1 block">
                            📎 {m.message_type}
                          </a>
                        )}
                        <div>{m.content || <em className="opacity-60">[{m.message_type}]</em>}</div>
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

              {/* AI Summary banner */}
              {aiSummary && (
                <div className="mx-3 mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1 relative">
                  <button onClick={() => setAiSummary(null)} className="absolute top-1 right-1 opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                  <p className="font-semibold flex items-center gap-1"><Wand2 className="h-3 w-3" />Resumo IA</p>
                  <p>{aiSummary.summary}</p>
                  {aiSummary.key_points.length > 0 && (
                    <ul className="list-disc list-inside opacity-80">
                      {aiSummary.key_points.map((k, i) => <li key={i}>{k}</li>)}
                    </ul>
                  )}
                  {aiSummary.next_action && <p className="italic opacity-80">→ {aiSummary.next_action}</p>}
                </div>
              )}

              {/* AI Suggestions */}
              {aiSuggestions && aiSuggestions.length > 0 && (
                <div className="mx-3 mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                  <p className="text-[10px] font-semibold uppercase opacity-70 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />Sugestões IA
                    <button onClick={() => setAiSuggestions(null)} className="ml-auto opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                  </p>
                  {aiSuggestions.map((s, i) => (
                    <button key={i} onClick={() => { setDraft(s); setAiSuggestions(null); }}
                      className="text-xs text-left w-full p-2 rounded hover:bg-primary/10 border border-transparent hover:border-primary/30 transition">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Quick actions */}
              <div className="px-3 pt-2 flex gap-1.5 flex-wrap border-t border-border">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => quickAction("send_pix", "PIX enviado")}>
                  <Wallet className="h-3 w-3" />PIX
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => quickAction("send_receipt_request", "Pedido enviado")}>
                  <FileText className="h-3 w-3" />Comprovante
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => aiCall("suggest")} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Sugerir
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => aiCall("summarize")} disabled={aiLoading}>
                  <Wand2 className="h-3 w-3" />Resumir
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => setScheduleOpen(true)}>
                  <Clock className="h-3 w-3" />Agendar
                </Button>
                {templates.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <FileText className="h-3 w-3" />Templates
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

              {/* Composer */}
              <div className="p-3 border-t border-border flex gap-2">
                <input ref={fileInputRef} type="file" className="hidden"
                  accept="image/*,application/pdf,audio/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); e.target.value = ""; }} />
                <Button size="icon" variant="outline" className="self-end h-10 w-10"
                  disabled={selected.blocked || sending} onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); send(); }
                  }}
                  placeholder={selected.blocked ? "Contato bloqueado" : "Digite (Enter envia, Shift+Enter nova linha, Ctrl+Enter envia)..."}
                  rows={2} className="resize-none" disabled={selected.blocked} />
                <Button onClick={send} disabled={sending || !draft.trim() || selected.blocked} className="self-end">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Modal Notas */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Notas internas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
                placeholder="Anotação privada (não enviada ao cliente)..." rows={3} />
            </div>
            <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>Adicionar nota</Button>
            <div className="max-h-72 overflow-y-auto space-y-2 pt-2 border-t">
              {notes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem notas ainda</p>}
              {notes.map(n => (
                <div key={n.id} className="text-xs p-2 bg-muted/40 rounded">
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Agendar */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agendar mensagem</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea value={scheduleText} onChange={(e) => setScheduleText(e.target.value)}
              placeholder="Mensagem..." rows={3} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().slice(0,10)} />
              <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancelar</Button>
            <Button onClick={scheduleSend} disabled={!scheduleText.trim() || !scheduleDate || !scheduleTime || sending}>
              <Clock className="h-4 w-4 mr-1" />Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Métricas avançadas */}
      <Dialog open={metricsOpen} onOpenChange={setMetricsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Métricas avançadas (7 dias)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Mensagens recebidas por hora do dia</p>
              <div className="flex items-end gap-1 h-40">
                {hourlyStats.map(h => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-primary/70 rounded-t transition-all hover:bg-primary"
                      style={{ height: `${(h.count / maxHourly) * 100}%`, minHeight: h.count ? "4px" : "2px" }}
                      title={`${h.count} msgs`} />
                    <span className="text-[8px] text-muted-foreground">{h.hour}h</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-muted/40 rounded">
                <p className="text-[10px] uppercase text-muted-foreground">Total recebidas</p>
                <p className="text-2xl font-bold">{hourlyStats.reduce((s, h) => s + h.count, 0)}</p>
              </div>
              <div className="p-3 bg-muted/40 rounded">
                <p className="text-[10px] uppercase text-muted-foreground">Pico de hora</p>
                <p className="text-2xl font-bold">{hourlyStats.findIndex(h => h.count === maxHourly)}h</p>
              </div>
              <div className="p-3 bg-muted/40 rounded">
                <p className="text-[10px] uppercase text-muted-foreground">% resolvidas por bot</p>
                <p className="text-2xl font-bold">
                  {metrics.botReplies7d + metrics.humanReplies7d > 0
                    ? Math.round((metrics.botReplies7d / (metrics.botReplies7d + metrics.humanReplies7d)) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Ações do bot</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-3">
            {actionsLoading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Carregando…</div>
            ) : botActions.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma ação registrada para esta conversa.</div>
            ) : (
              <div className="space-y-2">
                {botActions.map((a) => (
                  <div key={a.id} className="border border-border rounded-lg p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={a.success ? "default" : "destructive"} className="text-[10px]">
                          {a.success ? "OK" : "Falhou"}
                        </Badge>
                        <span className="font-mono font-semibold">{a.tool_name}</span>
                      </div>
                      <span className="text-muted-foreground text-[10px]">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    {a.tool_input && Object.keys(a.tool_input).length > 0 && (
                      <pre className="bg-muted/40 rounded p-2 overflow-x-auto text-[10px] leading-relaxed">
                        {JSON.stringify(a.tool_input, null, 2)}
                      </pre>
                    )}
                    {a.tool_output && (
                      <pre className="bg-muted/20 rounded p-2 overflow-x-auto text-[10px] leading-relaxed text-muted-foreground">
                        {typeof a.tool_output === "string" ? a.tool_output : JSON.stringify(a.tool_output, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: "warning" | "primary" }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${
        accent === "warning" && value > 0 ? "text-destructive" :
        accent === "primary" ? "text-primary" : ""}`}>{value}</p>
    </Card>
  );
}
