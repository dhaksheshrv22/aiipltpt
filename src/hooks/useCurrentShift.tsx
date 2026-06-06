import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentShift() {
  return useQuery({
    queryKey: ["currentShift"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .eq("status", "open")
        .order("start_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60_000,
  });
}
