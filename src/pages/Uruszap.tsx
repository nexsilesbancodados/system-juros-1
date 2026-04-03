import { useState, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Uruszap = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(100);
      setMessages(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Uruszap</h1>
        <p className="text-muted-foreground text-sm mt-1">Chat interno da equipe.</p>
      </div>

      <div className="rounded-xl border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma mensagem ainda.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs text-foreground flex-shrink-0">
                  {m.user_name?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{m.user_name} · {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="text-sm text-foreground">{m.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <input
            type="text"
            placeholder="Digite uma mensagem..."
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-input/80 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button className="px-3 py-2 rounded-lg text-primary-foreground" style={{ background: "var(--gradient-button)" }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Uruszap;
