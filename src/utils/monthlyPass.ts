import { addDays, differenceInDays } from "date-fns";
import { getPricingDetails } from "./pricing";

export const MONTHLY_DAYS = 30;

export function getMonthlyPrice(numWheels: number) {
  const p = getPricingDetails(numWheels);
  if (!p) return null;
  return { ...p, monthlyAmount: p.dailyRate * MONTHLY_DAYS };
}

export function generatePassId() {
  const year = new Date().getFullYear();
  const serial = Math.floor(10000 + Math.random() * 90000);
  return `MP-${year}-${serial}`;
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
