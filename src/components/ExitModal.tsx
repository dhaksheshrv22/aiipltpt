import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateBill, formatINR, formatDate, formatTime, formatDuration, generateReceiptNumber } from "@/utils/pricing";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import ReceiptModal from "@/components/ReceiptModal";
import UpiQR from "@/components/UpiQR";
import { AlertTriangle } from "lucide-react";

interface ExitModalProps {
  vehicle: any;
  onClose: () => void;
  onComplete: () => void;
}

function cleanCategory(cat: string): string {
  if (!cat) return "";
  return cat.replace(/[^\x20-\x7E]/g, "-");
}

export default function ExitModal({ vehicle, onClose, onComplete }: ExitModalProps) {
  const [exitPaymentMode, setExitPaymentMode] = useState(vehicle.payment_mode);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [confirmDue, setConfirmDue] = useState(false);
  const [amountPayingStr, setAmountPayingStr] = useState<string>("");
  const receiptSettings = useReceiptSettings();

  const { data: ledger = [] } = useQuery({
    queryKey: ["ledger", vehicle.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("vehicle_id", vehicle.id)
        .order("paid_at", { ascending: true });
      return data ?? [];
    },
  });

  const now = new Date();
  const isMonthlyPass = !!vehicle.is_monthly_pass;
  const rawBill = isMonthlyPass
    ? { totalHours: 0, billableDays: 0, grossAmount: 0, advanceDeduction: 0, balanceDue: 0 }
    : calculateBill(new Date(vehicle.entry_time), now, vehicle.daily_rate, vehicle.advance_paid ?? false);

  const advanceAmt = vehicle.advance_amount ?? 0;
  // ledger already includes advance + partial payments (inserted with vehicle_id)
  const ledgerTotal = ledger.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  // Defensive: if ledger missed historical entries, fall back to known amounts
  const totalPaidPre = Math.max(ledgerTotal, advanceAmt);
  const balanceDue = Math.max(0, rawBill.grossAmount - totalPaidPre);

  const amountPaying = amountPayingStr === "" ? balanceDue : Math.max(0, Math.min(balanceDue, parseFloat(amountPayingStr) || 0));
  const remainingDue = Math.max(0, balanceDue - amountPaying);

  const handleExit = async () => {
    if (balanceDue > 0 && !confirmDue) {
      toast.error("Confirm the collected amount before exit");
      return;
    }
    setLoading(true);
    const totalHours = parseFloat(rawBill.totalHours.toFixed(2));
    const receiptNo = vehicle.token_number || generateReceiptNumber(receiptSettings.prefix);

    const historyRow: any = {
      vehicle_number: vehicle.vehicle_number,
      driver_mobile: vehicle.driver_mobile,
      num_wheels: vehicle.num_wheels,
      pricing_category: vehicle.pricing_category,
      daily_rate: vehicle.daily_rate,
      entry_time: vehicle.entry_time,
      exit_time: now.toISOString(),
      total_hours: totalHours,
      total_days_billed: rawBill.billableDays,
      gross_amount: rawBill.grossAmount,
      advance_paid_amount: advanceAmt,
      balance_amount: remainingDue,
      payment_mode: vehicle.payment_mode,
      exit_payment_mode: exitPaymentMode,
      final_payment_status: remainingDue > 0 ? "Partial" : "Paid",
      token_number: vehicle.token_number ?? null,
    };

    const { data: historyEntry, error: histErr } = await supabase.from("vehicle_history").insert(historyRow).select().single();
    if (histErr) { toast.error("Exit failed: " + histErr.message); setLoading(false); return; }

    if (amountPaying > 0) {
      await supabase.from("payments").insert({
        history_vehicle_id: historyEntry.id,
        vehicle_number: vehicle.vehicle_number,
        payment_type: "Exit",
        amount: amountPaying,
        payment_mode: exitPaymentMode,
        notes: remainingDue > 0 ? `Partial — ${formatINR(remainingDue)} pending` : null,
      });
    }

    if (ledger.length > 0) {
      await supabase
        .from("payments")
        .update({ history_vehicle_id: historyEntry.id })
        .eq("vehicle_id", vehicle.id);
    }

    await supabase.from("active_vehicles").delete().eq("id", vehicle.id);

    const grandTotal = totalPaidPre + amountPaying;
    setReceipt({
      ...historyRow,
      receiptNo,
      balancePaid: amountPaying,
      totalPaid: grandTotal,
      ledger: [
        ...ledger,
        ...(amountPaying > 0 ? [{
          id: "exit",
          payment_type: "Exit",
          payment_mode: exitPaymentMode,
          amount: amountPaying,
          paid_at: now.toISOString(),
        }] : []),
      ],
    });
    setLoading(false);
    toast.success(`Vehicle ${vehicle.vehicle_number} exited`);
  };

  if (receipt) {
    return <ReceiptModal receipt={receipt} onClose={() => { onComplete(); }} />;
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Exit — {vehicle.vehicle_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Vehicle:</span>
            <span className="font-mono font-bold">{vehicle.vehicle_number}</span>
            <span className="text-muted-foreground">Category:</span>
            <span>{cleanCategory(vehicle.pricing_category)}</span>
            <span className="text-muted-foreground">Mobile No.:</span>
            <span>{vehicle.driver_mobile}</span>
            <span className="text-muted-foreground">Entry:</span>
            <span>{formatDate(vehicle.entry_time)} {formatTime(vehicle.entry_time)}</span>
            <span className="text-muted-foreground">Exit:</span>
            <span>{formatDate(now)} {formatTime(now)}</span>
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{formatDuration(new Date(vehicle.entry_time), now)}</span>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <h4 className="font-semibold">Billing Breakdown</h4>
            <div className="grid grid-cols-2 gap-1">
              <span>Billable Days:</span><span>{rawBill.billableDays}</span>
              <span>Gross Amount:</span><span>{formatINR(rawBill.grossAmount)}</span>
              <span>Already Paid:</span><span className="text-success">−{formatINR(totalPaidPre)}</span>
              <span className="font-bold text-base pt-1">Balance Due:</span>
              <span className={`font-bold text-base pt-1 ${balanceDue === 0 ? "text-success" : "text-destructive"}`}>
                {formatINR(balanceDue)}
              </span>
            </div>
          </div>

          {ledger.length > 0 && (
            <div className="border rounded-lg overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr><th className="p-2 text-left">When</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Mode</th><th className="p-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {ledger.map((p: any) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">{p.paid_at ? `${formatDate(p.paid_at)} ${formatTime(p.paid_at)}` : "—"}</td>
                      <td className="p-2">{p.payment_type}</td>
                      <td className="p-2">{p.payment_mode}</td>
                      <td className="p-2 text-right font-medium">{formatINR(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {balanceDue > 0 && (
            <>
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-destructive">Balance Due: {formatINR(balanceDue)}</p>
                  <p className="text-xs text-muted-foreground">Collect this amount before releasing the vehicle.</p>
                </div>
              </div>

              <div>
                <Label>Exit Payment Mode</Label>
                <RadioGroup value={exitPaymentMode} onValueChange={setExitPaymentMode} className="flex gap-4 mt-2">
                  {["Cash", "UPI", "Card"].map(m => (
                    <div key={m} className="flex items-center space-x-2">
                      <RadioGroupItem value={m} id={`exit-${m}`} />
                      <Label htmlFor={`exit-${m}`} className="cursor-pointer">{m}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {exitPaymentMode === "UPI" && (
                <UpiQR amount={balanceDue} vehicleNumber={vehicle.vehicle_number} />
              )}

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox checked={confirmDue} onCheckedChange={(v) => setConfirmDue(!!v)} />
                <span>I have collected {formatINR(balanceDue)} from the driver.</span>
              </label>
            </>
          )}

          <Button className="w-full" size="lg" onClick={handleExit} disabled={loading || (balanceDue > 0 && !confirmDue)}>
            {loading ? "Processing..." : "Complete Exit & Generate Receipt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
