import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Hash, Users, Search, Send, Paperclip, Smile, MoreVertical, Reply, Trash2, Pin, PinOff,
  Ban, ShieldCheck, LogIn, LogOut, MessageSquarePlus, Image as ImageIcon, X, Check, CheckCheck,
  Plus, Crown, ArrowLeft, Circle, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Channel { id: string; name: string; description: string | null; is_default: boolean; is_announcement: boolean; }
interface Member { user_id: string; channel_id: string; }
interface DMThread { id: string; user_a: string; user_b: string; last_message_at: string; }
interface Profile { id: string; name: string; avatar_url: string | null; is_admin: boolean; is_chat_blocked: boolean; }
interface Reaction { id: string; message_id: string; user_id: string; emoji: string; }
interface Message {
  id: string; channel_id: string | null; dm_thread_id: string | null;
  user_id: string; user_name: string; user_avatar: string | null;
  content: string; type: string; file_url: string | null; file_name: string | null; file_type: string | null;
  reply_to: { id: string; user_name: string; content: string } | null;
  is_pinned: boolean; is_deleted: boolean; deleted_by: string | null;
  edited_at: string | null; created_at: string;
}
type Scope = { kind: "channel"; id: string } | { kind: "dm"; id: string; otherUserId: string };

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];

const fmtTime = (s: string) => new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (s: string) => {
  const d = new Date(s); const today = new Date(); const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const Chat = () => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const isAdmin = !!profile?.is_admin;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [memberships, setMemberships] = useState<Member[]>([]);
  const [dmThreads, setDmThreads] = useState<DMThread[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // user_id -> name

  const [scope, setScope] = useState<Scope | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmoji, setShowEmoji] = useState<string | null>(null); // message id for picker
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"channels" | "dms" | "people">("channels");
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [uploading, setUploading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const presenceChannel = useRef<any>(null);

  // ============ INITIAL LOAD ============
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [chRes, memRes, dmRes, prfRes] = await Promise.all([
        supabase.from("chat_channels").select("*").order("is_default", { ascending: false }).order("name"),
        supabase.from("chat_channel_members").select("*"),
        supabase.from("chat_dm_threads").select("*").or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order("last_message_at", { ascending: false }),
        supabase.from("profiles").select("id, name, avatar_url, is_admin, is_chat_blocked"),
      ]);
      setChannels(chRes.data || []);
      setMemberships(memRes.data || []);
      setDmThreads(dmRes.data || []);
      const map: Record<string, Profile> = {};
      (prfRes.data || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);

      // auto-select default channel if member, otherwise the first channel
      const defaultCh = (chRes.data || []).find((c: any) => c.is_default);
      if (defaultCh) setScope({ kind: "channel", id: defaultCh.id });
    })();
  }, [user]);

  // ============ PRESENCE (online users) ============
  useEffect(() => {
    if (!user || !profile) return;
    const ch = supabase.channel("chat-presence", { config: { presence: { key: user.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setOnlineUsers(new Set(Object.keys(state)));
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ name: profile.name, online_at: new Date().toISOString() });
    });
    presenceChannel.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user, profile]);

  // ============ MEMBERSHIP REALTIME ============
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-membership-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_channel_members" }, async () => {
        const { data } = await supabase.from("chat_channel_members").select("*");
        setMemberships(data || []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_channels" }, async () => {
        const { data } = await supabase.from("chat_channels").select("*").order("name");
        setChannels(data || []);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // ============ MESSAGES + REACTIONS for current scope ============
  useEffect(() => {
    if (!scope) { setMessages([]); setReactions([]); return; }
    const isMember = scope.kind === "channel" ? memberships.some((m) => m.channel_id === scope.id && m.user_id === user?.id) : true;
    if (!isMember && scope.kind === "channel") { setMessages([]); setReactions([]); return; }

    const filterCol = scope.kind === "channel" ? "channel_id" : "dm_thread_id";
    (async () => {
      const { data: msgs } = await supabase.from("chat_messages").select("*").eq(filterCol, scope.id).order("created_at", { ascending: true }).limit(200);
      setMessages((msgs || []) as Message[]);
      const ids = (msgs || []).map((m: any) => m.id);
      if (ids.length) {
        const { data: rx } = await supabase.from("chat_message_reactions").select("*").in("message_id", ids);
        setReactions(rx || []);
      } else setReactions([]);

      // Mark as read
      const now = new Date().toISOString();
      if (scope.kind === "channel" && user) {
        await supabase
          .from("chat_channel_members")
          .update({ last_read_at: now })
          .eq("channel_id", scope.id)
          .eq("user_id", user.id);
      } else if (scope.kind === "dm") {
        localStorage.setItem(`chat-dm-read-${scope.id}`, now);
      }
      window.dispatchEvent(new CustomEvent("chat:read"));
    })();

    const ch = supabase
      .channel(`chat-msgs-${scope.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `${filterCol}=eq.${scope.id}` }, (payload) => {
        if (payload.eventType === "INSERT") setMessages((prev) => [...prev, payload.new as Message]);
        else if (payload.eventType === "UPDATE") setMessages((prev) => prev.map((m) => (m.id === (payload.new as any).id ? (payload.new as Message) : m)));
        else if (payload.eventType === "DELETE") setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" }, async (payload: any) => {
        if (payload.eventType === "INSERT") setReactions((prev) => [...prev, payload.new]);
        else if (payload.eventType === "DELETE") setReactions((prev) => prev.filter((r) => r.id !== payload.old.id));
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user_id === user?.id) return;
        setTypingUsers((prev) => ({ ...prev, [payload.user_id]: payload.user_name }));
        setTimeout(() => {
          setTypingUsers((prev) => { const n = { ...prev }; delete n[payload.user_id]; return n; });
        }, 3000);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, memberships]);

  // ============ AUTOSCROLL ============
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ============ DERIVED ============
  const myMembership = useMemo(() => new Set(memberships.filter((m) => m.user_id === user?.id).map((m) => m.channel_id)), [memberships, user]);
  const currentChannel = scope?.kind === "channel" ? channels.find((c) => c.id === scope.id) : null;
  const currentDM = scope?.kind === "dm" ? dmThreads.find((d) => d.id === scope.id) : null;
  const dmOther = scope?.kind === "dm" ? profiles[scope.otherUserId] : null;
  const isMemberOfCurrent = scope?.kind === "channel" ? myMembership.has(scope.id) : true;
  const channelMemberCount = (cid: string) => memberships.filter((m) => m.channel_id === cid).length;

  const visibleProfiles = useMemo(() => {
    return Object.values(profiles).filter((p) => p.id !== user?.id && (!search || p.name.toLowerCase().includes(search.toLowerCase())));
  }, [profiles, user, search]);

  const filteredChannels = channels.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const pinnedMessages = useMemo(() => messages.filter((m) => m.is_pinned && !m.is_deleted), [messages]);

  const reactionsByMessage = useMemo(() => {
    const map: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const r of reactions) {
      map[r.message_id] = map[r.message_id] || {};
      map[r.message_id][r.emoji] = map[r.message_id][r.emoji] || { count: 0, mine: false };
      map[r.message_id][r.emoji].count++;
      if (r.user_id === user?.id) map[r.message_id][r.emoji].mine = true;
    }
    return map;
  }, [reactions, user]);

  // ============ ACTIONS ============
  const join = async (channelId: string) => {
    if (!user) return;
    const { error } = await supabase.from("chat_channel_members").insert({ channel_id: channelId, user_id: user.id });
    if (error) toast.error("Erro ao entrar no canal"); else toast.success("Você entrou no canal");
  };

  const leave = async (channelId: string) => {
    if (!user) return;
    await supabase.from("chat_channel_members").delete().eq("channel_id", channelId).eq("user_id", user.id);
    toast.success("Você saiu do canal");
    if (scope?.kind === "channel" && scope.id === channelId) setScope(null);
  };

  const openDM = async (otherUserId: string) => {
    const { data, error } = await supabase.rpc("get_or_create_dm_thread", { _other_user: otherUserId });
    if (error || !data) return toast.error("Erro ao abrir conversa");
    const tid = data as string;
    // refresh threads
    const { data: dms } = await supabase.from("chat_dm_threads").select("*").or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
    setDmThreads(dms || []);
    setScope({ kind: "dm", id: tid, otherUserId });
    setTab("dms");
    if (isMobile) setShowSidebar(false);
  };

  const send = async () => {
    if (!user || !profile || !scope || !input.trim()) return;
    if (profile.is_chat_blocked) return toast.error("Você está bloqueado de enviar mensagens");
    const payload: any = {
      user_id: user.id, user_name: profile.name, user_avatar: profile.avatar_url || null,
      content: input.trim(), type: "text",
      reply_to: replyTo ? { id: replyTo.id, user_name: replyTo.user_name, content: replyTo.content.slice(0, 120) } : null,
    };
    if (scope.kind === "channel") payload.channel_id = scope.id; else payload.dm_thread_id = scope.id;
    setInput(""); setReplyTo(null);
    const { error } = await supabase.from("chat_messages").insert(payload);
    if (error) toast.error("Erro ao enviar: " + error.message);
  };

  const handleFile = async (file: File) => {
    if (!user || !profile || !scope) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo deve ter até 10MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `chat/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("uploads").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("uploads").getPublicUrl(path);
      const isImage = file.type.startsWith("image/");
      const payload: any = {
        user_id: user.id, user_name: profile.name, user_avatar: profile.avatar_url || null,
        content: isImage ? "" : file.name, type: isImage ? "image" : "file",
        file_url: pub.publicUrl, file_name: file.name, file_type: file.type,
      };
      if (scope.kind === "channel") payload.channel_id = scope.id; else payload.dm_thread_id = scope.id;
      await supabase.from("chat_messages").insert(payload);
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally { setUploading(false); }
  };

  const broadcastTyping = () => {
    if (!user || !profile || !scope) return;
    const ch = supabase.channel(`chat-msgs-${scope.id}`);
    ch.send({ type: "broadcast", event: "typing", payload: { user_id: user.id, user_name: profile.name } });
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) await supabase.from("chat_message_reactions").delete().eq("id", existing.id);
    else await supabase.from("chat_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    setShowEmoji(null);
  };

  const deleteMessage = async (m: Message) => {
    if (!user) return;
    if (m.user_id === user.id || isAdmin) {
      await supabase.from("chat_messages").update({ is_deleted: true, content: "[mensagem removida]", deleted_by: user.id }).eq("id", m.id);
      toast.success("Mensagem removida");
    }
    setOpenMenu(null);
  };

  const togglePin = async (m: Message) => {
    if (!isAdmin) return;
    await supabase.from("chat_messages").update({ is_pinned: !m.is_pinned }).eq("id", m.id);
    toast.success(m.is_pinned ? "Desfixada" : "Fixada");
    setOpenMenu(null);
  };

  const banUser = async (userId: string, ban: boolean) => {
    if (!isAdmin) return;
    await supabase.from("profiles").update({ is_chat_blocked: ban }).eq("id", userId);
    setProfiles((prev) => ({ ...prev, [userId]: { ...prev[userId], is_chat_blocked: ban } }));
    toast.success(ban ? "Usuário silenciado" : "Usuário liberado");
    setOpenMenu(null);
  };

  const clearAllMessages = async () => {
    if (!isAdmin || !scope) return;
    if (!confirm("Apagar TODO o histórico desta conversa? Esta ação é irreversível.")) return;
    const filterCol = scope.kind === "channel" ? "channel_id" : "dm_thread_id";
    await supabase.from("chat_messages").delete().eq(filterCol, scope.id);
    toast.success("Histórico limpo");
  };

  const createChannel = async () => {
    if (!isAdmin || !newChannelName.trim()) return;
    const { data, error } = await supabase.from("chat_channels").insert({
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
      created_by: user!.id,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("Canal criado");
    setNewChannelName(""); setShowCreateChannel(false);
    if (data) setScope({ kind: "channel", id: data.id });
  };

  const deleteChannel = async (channelId: string) => {
    if (!isAdmin) return;
    if (!confirm("Excluir este canal e todas as mensagens?")) return;
    await supabase.from("chat_channels").delete().eq("id", channelId);
    toast.success("Canal excluído");
    if (scope?.kind === "channel" && scope.id === channelId) setScope(null);
  };

  // ============ RENDER ============
  const groupedMessages = useMemo(() => {
    const groups: { date: string; items: Message[] }[] = [];
    let lastDate = "";
    for (const m of messages) {
      const d = fmtDay(m.created_at);
      if (d !== lastDate) { groups.push({ date: d, items: [m] }); lastDate = d; }
      else groups[groups.length - 1].items.push(m);
    }
    return groups;
  }, [messages]);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex bg-background">
      {/* ============ SIDEBAR ============ */}
      {(showSidebar || !isMobile) && (
        <aside className={`${isMobile ? "absolute inset-0 z-30" : "w-72"} bg-card border-r border-border flex flex-col`}>
          <div className="p-3 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles size={16} className="text-primary" /> Chat
              </h1>
              {isMobile && (
                <button onClick={() => setShowSidebar(false)} className="p-1.5 rounded-lg hover:bg-muted/50">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-muted/30 border border-border/40">
              <Search size={13} className="text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-xs outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-muted/30 rounded-xl">
              {(["channels", "dms", "people"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t === "channels" ? "Canais" : t === "dms" ? "DMs" : "Pessoas"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {tab === "channels" && (
              <>
                {isAdmin && (
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-xl text-xs font-semibold text-primary border border-dashed border-primary/30 hover:bg-primary/5 transition"
                  >
                    <Plus size={13} /> Novo canal
                  </button>
                )}
                {filteredChannels.map((c) => {
                  const member = myMembership.has(c.id);
                  const active = scope?.kind === "channel" && scope.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition ${active ? "bg-primary/10" : "hover:bg-accent/40"}`}
                      onClick={() => { setScope({ kind: "channel", id: c.id }); if (isMobile) setShowSidebar(false); }}
                    >
                      <Hash size={14} className={active ? "text-primary" : "text-muted-foreground"} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${active ? "text-foreground" : "text-muted-foreground"}`}>{c.name}</p>
                        <p className="text-[10px] text-muted-foreground/70">{channelMemberCount(c.id)} membros{member ? " · você" : ""}</p>
                      </div>
                      {member ? (
                        <button onClick={(e) => { e.stopPropagation(); leave(c.id); }} title="Sair" className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                          <LogOut size={11} />
                        </button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); join(c.id); }} title="Entrar" className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-success/10 text-muted-foreground hover:text-success transition">
                          <LogIn size={11} />
                        </button>
                      )}
                      {isAdmin && !c.is_default && (
                        <button onClick={(e) => { e.stopPropagation(); deleteChannel(c.id); }} title="Excluir canal" className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {tab === "dms" && (
              <>
                {dmThreads.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhuma conversa direta. Vá em "Pessoas" para iniciar.</p>
                ) : dmThreads.map((d) => {
                  const otherId = d.user_a === user?.id ? d.user_b : d.user_a;
                  const other = profiles[otherId];
                  if (!other) return null;
                  const active = scope?.kind === "dm" && scope.id === d.id;
                  const online = onlineUsers.has(otherId);
                  return (
                    <div
                      key={d.id}
                      onClick={() => { setScope({ kind: "dm", id: d.id, otherUserId: otherId }); if (isMobile) setShowSidebar(false); }}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition ${active ? "bg-primary/10" : "hover:bg-accent/40"}`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                          {other.avatar_url ? <img src={other.avatar_url} alt="" className="w-8 h-8 object-cover" /> : other.name.charAt(0).toUpperCase()}
                        </div>
                        {online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-card" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                          {other.name}
                          {other.is_admin && <Crown size={10} className="text-warning" />}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">{online ? "online" : "offline"}</p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {tab === "people" && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold px-2 py-1.5">{visibleProfiles.length} usuários</p>
                {visibleProfiles.map((p) => {
                  const online = onlineUsers.has(p.id);
                  return (
                    <div key={p.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-accent/40 transition">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                          {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-8 h-8 object-cover" /> : p.name.charAt(0).toUpperCase()}
                        </div>
                        {online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-card" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                          {p.name}
                          {p.is_admin && <Crown size={10} className="text-warning" />}
                          {p.is_chat_blocked && <Ban size={10} className="text-destructive" />}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">{online ? "online" : "offline"}</p>
                      </div>
                      <button onClick={() => openDM(p.id)} title="Mensagem direta" className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">
                        <MessageSquarePlus size={12} />
                      </button>
                      {isAdmin && p.id !== user?.id && (
                        <button
                          onClick={() => banUser(p.id, !p.is_chat_blocked)}
                          title={p.is_chat_blocked ? "Liberar" : "Silenciar"}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-muted/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                        >
                          {p.is_chat_blocked ? <ShieldCheck size={12} /> : <Ban size={12} />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-muted/20">
              <Circle size={8} className="text-success fill-success" />
              <span className="text-[11px] text-muted-foreground font-semibold">{onlineUsers.size} online</span>
            </div>
          </div>
        </aside>
      )}

      {/* ============ MAIN CHAT AREA ============ */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {!scope ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Bem-vindo ao Chat</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">Selecione um canal, conversa direta ou inicie uma nova.</p>
            {isMobile && (
              <button onClick={() => setShowSidebar(true)} className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
                Ver conversas
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-14 px-3 lg:px-4 border-b border-border flex items-center justify-between gap-3 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 min-w-0">
                {isMobile && (
                  <button onClick={() => setShowSidebar(true)} className="p-1.5 rounded-lg hover:bg-muted/50">
                    <ArrowLeft size={16} />
                  </button>
                )}
                {currentChannel ? (
                  <>
                    <Hash size={16} className="text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{currentChannel.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {channelMemberCount(currentChannel.id)} membros{currentChannel.description ? ` · ${currentChannel.description}` : ""}
                      </p>
                    </div>
                  </>
                ) : dmOther ? (
                  <>
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                        {dmOther.avatar_url ? <img src={dmOther.avatar_url} alt="" className="w-8 h-8 object-cover" /> : dmOther.name.charAt(0).toUpperCase()}
                      </div>
                      {onlineUsers.has(dmOther.id) && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-card" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate flex items-center gap-1">
                        {dmOther.name}
                        {dmOther.is_admin && <Crown size={10} className="text-warning" />}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{onlineUsers.has(dmOther.id) ? "online" : "offline"}</p>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {currentChannel && !isMemberOfCurrent && (
                  <button onClick={() => join(currentChannel.id)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition flex items-center gap-1.5">
                    <LogIn size={11} /> Entrar
                  </button>
                )}
                {currentChannel && isMemberOfCurrent && !currentChannel.is_default && (
                  <button onClick={() => leave(currentChannel.id)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-muted/40 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex items-center gap-1.5">
                    <LogOut size={11} /> Sair
                  </button>
                )}
                {isAdmin && (
                  <button onClick={clearAllMessages} title="Limpar histórico" className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Pinned bar */}
            {pinnedMessages.length > 0 && (
              <div className="px-4 py-2 border-b border-border/40 bg-warning/5 flex items-center gap-2">
                <Pin size={12} className="text-warning shrink-0" />
                <p className="text-xs text-foreground/80 truncate"><b>Fixada:</b> {pinnedMessages[pinnedMessages.length - 1].content}</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-1">
              {scope.kind === "channel" && !isMemberOfCurrent ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                    <Hash size={22} className="text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Você não está neste canal</p>
                  <p className="text-xs text-muted-foreground mt-1">Entre para ver e enviar mensagens.</p>
                  <button onClick={() => join(scope.id)} className="mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5">
                    <LogIn size={12} /> Entrar no canal
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga olá! 👋</p>
                </div>
              ) : (
                groupedMessages.map((g) => (
                  <div key={g.date}>
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-border/40" />
                      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-2 py-0.5 rounded-full bg-muted/30">{g.date}</span>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>
                    {g.items.map((m, i) => {
                      const prev = g.items[i - 1];
                      const sameAuthor = prev && prev.user_id === m.user_id && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000);
                      const mine = m.user_id === user?.id;
                      const author = profiles[m.user_id];
                      const rxs = reactionsByMessage[m.id] || {};
                      return (
                        <div key={m.id} className={`group flex gap-2.5 ${sameAuthor ? "mt-0.5" : "mt-3"}`}>
                          <div className="w-8 shrink-0">
                            {!sameAuthor && (
                              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                                {m.user_avatar ? <img src={m.user_avatar} alt="" className="w-8 h-8 object-cover" /> : m.user_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 relative">
                            {!sameAuthor && (
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-xs font-bold ${mine ? "text-primary" : "text-foreground"}`}>{m.user_name}</span>
                                {author?.is_admin && <Crown size={9} className="text-warning" />}
                                <span className="text-[10px] text-muted-foreground/60">{fmtTime(m.created_at)}</span>
                              </div>
                            )}
                            {m.reply_to && (
                              <div className="mb-1 pl-2 border-l-2 border-primary/40 text-[11px]">
                                <p className="text-primary font-semibold">{m.reply_to.user_name}</p>
                                <p className="text-muted-foreground truncate">{m.reply_to.content}</p>
                              </div>
                            )}
                            <div className={`relative inline-block max-w-[85%] ${m.is_pinned ? "ring-1 ring-warning/40" : ""}`}>
                              {m.is_deleted ? (
                                <p className="text-xs italic text-muted-foreground/60">[mensagem removida]</p>
                              ) : m.type === "image" && m.file_url ? (
                                <a href={m.file_url} target="_blank" rel="noreferrer">
                                  <img src={m.file_url} alt={m.file_name || ""} className="rounded-xl max-h-64 max-w-xs object-cover border border-border" />
                                </a>
                              ) : m.type === "file" && m.file_url ? (
                                <a href={m.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border hover:bg-muted/60 transition">
                                  <Paperclip size={14} className="text-primary" />
                                  <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{m.file_name}</span>
                                </a>
                              ) : (
                                <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                              )}
                              {m.is_pinned && <Pin size={10} className="absolute -top-1.5 -right-1.5 text-warning bg-card rounded-full p-0.5" fill="currentColor" />}
                            </div>
                            {/* Reactions */}
                            {Object.keys(rxs).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(rxs).map(([emoji, info]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(m.id, emoji)}
                                    className={`text-[11px] px-1.5 py-0.5 rounded-full border transition ${info.mine ? "bg-primary/15 border-primary/40 text-foreground" : "bg-muted/40 border-border hover:border-primary/30"}`}
                                  >
                                    {emoji} {info.count}
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Hover actions */}
                            {!m.is_deleted && (
                              <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border rounded-lg shadow-lg flex items-center p-0.5">
                                <button onClick={() => setShowEmoji(showEmoji === m.id ? null : m.id)} className="p-1.5 hover:bg-muted/50 rounded-md text-muted-foreground hover:text-foreground" title="Reagir">
                                  <Smile size={13} />
                                </button>
                                <button onClick={() => { setReplyTo(m); inputRef.current?.focus(); }} className="p-1.5 hover:bg-muted/50 rounded-md text-muted-foreground hover:text-foreground" title="Responder">
                                  <Reply size={13} />
                                </button>
                                {(mine || isAdmin) && (
                                  <button onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)} className="p-1.5 hover:bg-muted/50 rounded-md text-muted-foreground hover:text-foreground" title="Mais">
                                    <MoreVertical size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                            {showEmoji === m.id && (
                              <div className="absolute z-20 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl p-1.5 flex gap-1">
                                {EMOJIS.map((e) => (
                                  <button key={e} onClick={() => toggleReaction(m.id, e)} className="text-base hover:scale-125 transition-transform p-1">
                                    {e}
                                  </button>
                                ))}
                              </div>
                            )}
                            {openMenu === m.id && (
                              <div className="absolute z-20 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                                {isAdmin && (
                                  <button onClick={() => togglePin(m)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground">
                                    {m.is_pinned ? <PinOff size={12} /> : <Pin size={12} />} {m.is_pinned ? "Desfixar" : "Fixar"}
                                  </button>
                                )}
                                <button onClick={() => deleteMessage(m)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-destructive/10 text-destructive">
                                  <Trash2 size={12} /> Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEnd} />

              {/* Typing */}
              {Object.keys(typingUsers).length > 0 && (
                <div className="px-2 py-1 text-[11px] text-muted-foreground italic flex items-center gap-1">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  {Object.values(typingUsers).join(", ")} digitando...
                </div>
              )}
            </div>

            {/* Input */}
            {(scope.kind === "dm" || isMemberOfCurrent) && (
              <div className="p-3 border-t border-border bg-card/40">
                {replyTo && (
                  <div className="mb-2 flex items-start gap-2 p-2 rounded-xl bg-muted/30 border-l-2 border-primary">
                    <Reply size={12} className="text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-primary">Respondendo {replyTo.user_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="p-0.5 hover:bg-muted/60 rounded">
                      <X size={12} />
                    </button>
                  </div>
                )}
                {profile?.is_chat_blocked ? (
                  <div className="text-center py-3 text-xs text-destructive font-semibold">
                    <Ban size={14} className="inline mr-1" /> Você foi silenciado pelo administrador
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <input ref={fileRef} type="file" hidden accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} className="p-2.5 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition shrink-0">
                      {uploading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Paperclip size={16} />}
                    </button>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => { setInput(e.target.value); broadcastTyping(); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder={`Mensagem em ${currentChannel ? `#${currentChannel.name}` : dmOther?.name || ""}...`}
                      rows={1}
                      className="flex-1 resize-none bg-muted/30 border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 max-h-32"
                    />
                    <button onClick={send} disabled={!input.trim()} className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0">
                      <Send size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Create channel modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowCreateChannel(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Plus size={18} className="text-primary" /> Novo canal
            </h3>
            <input
              autoFocus
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createChannel()}
              placeholder="ex: anuncios"
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
            />
            <p className="text-[10px] text-muted-foreground mt-2">Será criado como <code className="bg-muted/40 px-1 rounded">#{newChannelName.toLowerCase().replace(/\s+/g, "-") || "nome"}</code></p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreateChannel(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/40">Cancelar</button>
              <button onClick={createChannel} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">Criar canal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
