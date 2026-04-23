import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Native Web Notification API integration.
 * - Reads `settings.push_notifications_enabled` for the current user.
 * - When enabled, requests permission once and listens to `notifications` table inserts
 *   via Supabase realtime, displaying a desktop notification per row.
 * - Stores last-seen timestamp in localStorage to avoid re-notifying old rows.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const lastSeenRef = useRef<number>(0);

  const { data: settings } = useQuery({
    queryKey: ["push-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("push_notifications_enabled")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Request permission when enabled
  useEffect(() => {
    if (!settings?.push_notifications_enabled) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [settings?.push_notifications_enabled]);

  // Subscribe to new notifications
  useEffect(() => {
    if (!user) return;
    if (!settings?.push_notifications_enabled) return;
    if (typeof Notification === "undefined") return;

    // Initialize last-seen
    const key = `push-last-seen-${user.id}`;
    const stored = localStorage.getItem(key);
    lastSeenRef.current = stored ? Number(stored) : Date.now();

    const channel = supabase
      .channel(`push-notifs-${user.id}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          const ts = new Date(row.sent_at || row.created_at).getTime();
          if (ts <= lastSeenRef.current) return;
          lastSeenRef.current = ts;
          localStorage.setItem(key, String(ts));

          if (Notification.permission === "granted") {
            const n = new Notification(row.from || "Sistema", {
              body: row.message,
              tag: row.id,
              icon: "/favicon.ico",
            });
            if (row.link) {
              n.onclick = () => {
                window.focus();
                window.location.href = row.link;
              };
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, settings?.push_notifications_enabled]);
}
