import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLES = ["land_record", "documents", "record_history", "validation_flag", "audit_log"];

/** Keeps every dashboard/queue/record view in sync with the database in real time. */
export function useLiveData() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("portal-live");
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void queryClient.invalidateQueries();
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
