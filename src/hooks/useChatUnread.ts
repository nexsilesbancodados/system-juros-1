import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Counts unread chat messages across all channels the user is a member of
 * and all DM threads. Channels use chat_channel_members.last_read_at as the
 * watermark; DMs use a per-thread localStorage timestamp updated when the
 * Chat page opens that thread.
 *
 * Recomputes on:
 *  - mount
 *  - any insert into chat_messages (realtime)
 *  - tab focus
 *  - same-tab "chat:read" custom event (dispatched by Chat page when scope changes)
 */
export function useChatUnread() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const compute = async () => {
      // 1. Channel memberships with last_read_at
      const { data: members } = await supabase
        .from("chat_channel_members")
        .select("channel_id, last_read_at")
        .eq("user_id", user.id);

      // 2. DM threads
      const { data: dms } = await supabase
        .from("chat_dm_threads")
        .select("id")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      let total = 0;

      // Count unread per channel
      for (const m of members || []) {
        const { count: c } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("channel_id", m.channel_id)
          .neq("user_id", user.id)
          .gt("created_at", m.last_read_at || new Date(0).toISOString());
        total += c || 0;
      }

      // Count unread per DM thread (watermark from localStorage)
      for (const d of dms || []) {
        const ts = localStorage.getItem(`chat-dm-read-${d.id}`) || new Date(0).toISOString();
        const { count: c } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("dm_thread_id", d.id)
          .neq("user_id", user.id)
          .gt("created_at", ts);
        total += c || 0;
      }

      if (!cancelled) setCount(total);
    };

    compute();

    // Realtime: any new message → recompute (cheap counts)
    const channel = supabase
      .channel(`chat-unread-${user.id}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => compute(),
      )
      .subscribe();

    const onFocus = () => compute();
    const onRead = () => compute();
    window.addEventListener("focus", onFocus);
    window.addEventListener("chat:read", onRead);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("chat:read", onRead);
    };
  }, [user]);

  return count;
}
