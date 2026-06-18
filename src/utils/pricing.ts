import { format, differenceInMilliseconds } from "date-fns";

// Assumption: Single facility, single admin — no multi-tenancy
// Assumption: All amounts in Indian Rupees (₹), integers only
// Assumption: "Day" = any started 24-hour block after the 26-hour first-day grace

export interface PricingDetails {
  category: string;
  dailyRate: number;
}

export interface BillingResult {
  totalHours: number;
  billableDays: number;
  grossAmount: number;
  advanceDeduction: number;
  balanceDue: number;
}

export function getPricingDetails(numWheels: number): PricingDetails | null {
  if (numWheels === 4) return { category: "4-Wheeler", dailyRate: 100 };
  if (numWheels === 6) return { category: "6-Wheeler", dailyRate: 150 };
  if (numWheels >= 7 && numWheels <= 10) return { category: "7–10 Wheeler", dailyRate: 200 };
  if (numWheels >= 11 && numWheels <= 14) return { category: "11–14 Wheeler", dailyRate: 250 };
  if (numWheels >= 15 && numWheels <= 20) return { category: "15–20 Wheeler", dailyRate: 350 };
  if (numWheels > 20) return { category: "20+ Wheeler", dailyRate: 400 };
  return null; // invalid
}

export function getValidWheelCounts(): string {
  return "4, 6, 7–10, 11–14, 15–20, 21+";
}

export function calculateBill(
  entryTime: Date,
  exitTime: Date,
  dailyRate: number,
  advancePaid: boolean
): BillingResult {
  const diffMs = differenceInMilliseconds(exitTime, entryTime);
  const totalHours = diffMs / (1000 * 60 * 60);

  let billableDays: number;
  let grossAmount: number;

  if (totalHours <= 0) {
    billableDays = 0;
    grossAmount = 0;
  } else if (totalHours <= 1) {
    // Minimum billing: 50% of daily rate
    billableDays = 0.5;
    grossAmount = Math.round(dailyRate * 0.5);
  } else if (totalHours <= 26) {
    // 1 full day (26-hour grace period for first day)
    billableDays = 1;
    grossAmount = dailyRate;
  } else {
    // After first day (26h), each additional 24h block = 1 day
    billableDays = 1 + Math.ceil((totalHours - 26) / 24);
    grossAmount = billableDays * dailyRate;
  }

  const advanceDeduction = advancePaid ? dailyRate : 0;
  const balanceDue = Math.max(0, grossAmount - advanceDeduction);

  return { totalHours, billableDays, grossAmount, advanceDeduction, balanceDue };
}

export function formatDuration(entryTime: Date, exitTime: Date): string {
  const diffMs = differenceInMilliseconds(exitTime, entryTime);
  if (diffMs <= 0) return "0 min";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min`);

  return parts.join(", ");
}

export function isOverstay(entryTime: Date | string, isMonthlyPass: boolean = false): boolean {
  if (isMonthlyPass) return false;
  const entry = typeof entryTime === "string" ? new Date(entryTime) : entryTime;
  const diffHours = differenceInMilliseconds(new Date(), entry) / (1000 * 60 * 60);
  return diffHours > 168; // 7 days
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd MMM yyyy, hh:mm a");
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd MMM yyyy");
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "hh:mm a");
}

export function generateReceiptNumber(prefix: string = "AIIPL"): string {
  // Fallback only (used when token RPC is unavailable). Prefer DB-issued tokens.
  const year = new Date().getFullYear();
  const ts = Date.now().toString().slice(-6);
  return `${prefix}-${year}-${ts}`;
}
