import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Uruszap = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200);
      setMessages(data || []);
      setLoading(false);
      scrollToBottom();
    };
    fetchMessages();

    const channel = supabase
      .channel("chat-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        scrollToBottom();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSend = async () => {
    if (!user || !newMsg.trim()) return;
    const content = newMsg.trim();
    setNewMsg("");
    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      user_name: profile?.name || "Usuário",
      user_avatar: profile?.avatar_url || null,
      content,
      type: "text",
    });
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("chat_messages").delete().eq("id", id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Uruszap</h1>
        <p className="text-muted-foreground text-sm mt-1">Chat interno da equipe em tempo real.</p>
      </div>

      <div className="rounded-xl border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma mensagem ainda. Seja o primeiro!</p>
            </div>
          ) : (
            messages.map((m) => {
              const isOwn = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex gap-3 group ${isOwn ? "flex-row-reverse" : ""}`}>
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs text-foreground flex-shrink-0">
                    {m.user_avatar ? (
                      <img src={m.user_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      m.user_name?.charAt(0)?.toUpperCase() || "?"
                    )}
                  </div>
                  <div className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {m.user_name} · {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {isOwn && (
                        <button onClick={() => handleDelete(m.id)} className="ml-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity inline-flex">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </p>
                    <div className={`inline-block rounded-lg px-3 py-2 text-sm ${isOwn ? "bg-primary/20 text-foreground" : "bg-accent text-foreground"}`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <input
            type="text"
            placeholder="Digite uma mensagem..."
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={handleSend} disabled={!newMsg.trim()} className="px-3 py-2 rounded-lg text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-button)" }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Uruszap;
