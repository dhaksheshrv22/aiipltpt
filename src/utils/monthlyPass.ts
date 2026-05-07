import { addDays, differenceInDays } from "date-fns";
import { getPricingDetails } from "./pricing";

export const MONTHLY_DAYS = 30;

export function getMonthlyPrice(numWheels: number) {
  const p = getPricingDetails(numWheels);
  if (!p) return null;
  return { ...p, monthlyAmount: p.dailyRate * MONTHLY_DAYS };
}

export function generatePassId(prefix: string = "AIIPL") {
  const year = new Date().getFullYear();
  const serial = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-MP-${year}-${String(serial).padStart(4, "0")}`;
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
