import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Supabase realtime changes on a table and
 * invalidate the given React Query keys on any change.
 */
export function useRealtimeSubscription(
  tableName: string,
  queryKeys: string[][],
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${tableName}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: tableName },
        () => {
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, queryClient]); // queryKeys is stable by convention
}

/**
 * Subscribe to multiple tables at once, invalidating the same query key(s).
 */
export function useMultiTableRealtime(
  tables: string[],
  queryKeys: string[][],
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = tables.map((table) =>
      supabase
        .channel(`realtime-multi-${table}`)
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table },
          () => {
            queryKeys.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          },
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [queryClient, ...tables]);
}
