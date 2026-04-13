import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReceiptSettings {
  companyName: string;
  headerText: string;
  footerText: string;
  contactInfo: string;
  prefix: string;
}

const DEFAULTS: ReceiptSettings = {
  companyName: "AIIPL TRUCK PARKING TERMINAL",
  headerText: "PARKING TOKEN",
  footerText: "Thank you for using our facility!",
  contactInfo: "",
  prefix: "AIIPL",
};

export function useReceiptSettings() {
  const { data: settings = DEFAULTS } = useQuery({
    queryKey: ["receiptSettings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*").limit(1).single();
      if (!data) return DEFAULTS;
      return {
        companyName: (data as any).receipt_company_name ?? DEFAULTS.companyName,
        headerText: (data as any).receipt_header_text ?? DEFAULTS.headerText,
        footerText: (data as any).receipt_footer_text ?? DEFAULTS.footerText,
        contactInfo: (data as any).receipt_contact_info ?? DEFAULTS.contactInfo,
        prefix: (data as any).receipt_prefix ?? DEFAULTS.prefix,
      } as ReceiptSettings;
    },
  });

  return settings;
}
