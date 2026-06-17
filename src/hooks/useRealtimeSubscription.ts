import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscribe to Supabase realtime changes on a table and
 * invalidate the given React Query keys on any change.
 *
 * Channels are scoped per-tenant (`tenant:<uid>:...`) so the
 * Realtime RLS policy can isolate broadcasts between users.
 */
export function useRealtimeSubscription(
  tableName: string,
  queryKeys: string[][],
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(
      `tenant:${user.id}:rt-${tableName}-${Math.random().toString(36).slice(2)}`,
    );
    channel.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: tableName },
      () => {
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      },
    );
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, queryClient, user?.id]); // queryKeys is stable by convention
}

/**
 * Subscribe to multiple tables at once, invalidating the same query key(s).
 */
export function useMultiTableRealtime(
  tables: string[],
  queryKeys: string[][],
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const channels = tables.map((table) => {
      const ch = supabase.channel(
        `tenant:${user.id}:rt-multi-${table}-${Math.random().toString(36).slice(2)}`,
      );
      ch.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        },
      );
      ch.subscribe();
      return ch;
    });

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [queryClient, user?.id, ...tables]);
}
