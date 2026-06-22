import { addDays, differenceInDays } from "date-fns";
import { getPricingDetails } from "./pricing";
import { supabase } from "@/integrations/supabase/client";

export const MONTHLY_DAYS = 30;
export const MONTHLY_DISCOUNT = 0.2; // 20% discount on monthly pass

export function getMonthlyPrice(numWheels: number) {
  const p = getPricingDetails(numWheels);
  if (!p) return null;
  const monthlyAmount = Math.round(p.dailyRate * MONTHLY_DAYS * (1 - MONTHLY_DISCOUNT));
  return { ...p, monthlyAmount };
}

// Format: AIIPL-YEAR-MP-0000 (sequential per year)
export async function generatePassId(prefix: string = "AIIPL") {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-MP-%`;
  const { data } = await supabase
    .from("monthly_passes")
    .select("pass_id")
    .like("pass_id", pattern);
  const maxSeq = (data ?? []).reduce((m, r: any) => {
    const match = /-MP-(\d+)$/.exec(r.pass_id || "");
    const n = match ? parseInt(match[1], 10) : 0;
    return n > m ? n : m;
  }, 0);
  return `${prefix}-${year}-MP-${String(maxSeq + 1).padStart(4, "0")}`;
}

export function getPassStatus(expiry: string | Date): "Active" | "Expired" {
  return new Date(expiry).getTime() > Date.now() ? "Active" : "Expired";
}

export function daysUntilExpiry(expiry: string | Date): number {
  return differenceInDays(new Date(expiry), new Date());
}

export function computeExpiry(start: Date | string) {
  return addDays(new Date(start), MONTHLY_DAYS);
}
