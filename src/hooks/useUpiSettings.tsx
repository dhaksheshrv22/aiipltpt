import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UpiSettings {
  upiId: string;
  payeeName: string;
  creditLimit: number;
}

export function useUpiSettings(): UpiSettings {
  const { data } = useQuery({
    queryKey: ["upiSettings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .single();
      return data as any;
    },
    staleTime: 60_000,
  });

  return {
    upiId: data?.upi_id ?? "",
    payeeName: data?.upi_payee_name ?? data?.receipt_company_name ?? "",
    creditLimit: data?.credit_limit_amount ?? 0,
  };
}

export function buildUpiLink(opts: {
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName,
    am: String(opts.amount),
    tn: opts.note,
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}
