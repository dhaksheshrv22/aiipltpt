import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateBill, formatINR, formatDate, formatTime, formatDuration, generateReceiptNumber } from "@/utils/pricing";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import ReceiptModal from "@/components/ReceiptModal";

interface ExitModalProps {
  vehicle: any;
  onClose: () => void;
  onComplete: () => void;
}

// Fix category display - remove non-ASCII chars (Chinese chars from dash encoding)
function cleanCategory(cat: string): string {
  if (!cat) return "";
  return cat.replace(/[^\x20-\x7E]/g, "-");
}

export default function ExitModal({ vehicle, onClose, onComplete }: ExitModalProps) {
  const [exitPaymentMode, setExitPaymentMode] = useState(vehicle.payment_mode);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const now = new Date();
  const bill = calculateBill(new Date(vehicle.entry_time), now, vehicle.daily_rate, vehicle.advance_paid ?? false);

  const handleExit = async () => {
    setLoading(true);
    const totalHours = parseFloat(bill.totalHours.toFixed(2));
    const receiptNo = generateReceiptNumber();

    const historyRow = {
      vehicle_number: vehicle.vehicle_number,
      driver_mobile: vehicle.driver_mobile,
      num_wheels: vehicle.num_wheels,
      pricing_category: vehicle.pricing_category,
      daily_rate: vehicle.daily_rate,
      entry_time: vehicle.entry_time,
      exit_time: now.toISOString(),
      total_hours: totalHours,
      total_days_billed: bill.billableDays,
      gross_amount: bill.grossAmount,
      advance_paid_amount: vehicle.advance_amount ?? 0,
      balance_amount: bill.balanceDue,
      payment_mode: vehicle.payment_mode,
      exit_payment_mode: exitPaymentMode,
      final_payment_status: "Paid",
    };

    const { data: historyEntry, error: histErr } = await supabase.from("vehicle_history").insert(historyRow).select().single();
    if (histErr) { toast.error("Exit failed: " + histErr.message); setLoading(false); return; }

    if (bill.balanceDue > 0) {
      await supabase.from("payments").insert({
        history_vehicle_id: historyEntry.id,
        vehicle_number: vehicle.vehicle_number,
        payment_type: "Exit",
        amount: bill.balanceDue,
        payment_mode: exitPaymentMode,
      });
    }

    await supabase.from("active_vehicles").delete().eq("id", vehicle.id);

    setReceipt({ ...historyRow, receiptNo, balancePaid: bill.balanceDue, totalPaid: bill.grossAmount });
    setLoading(false);
    toast.success(`Vehicle ${vehicle.vehicle_number} exited successfully`);
  };

  if (receipt) {
    return <ReceiptModal receipt={receipt} onClose={() => { onComplete(); }} />;
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
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
            <span className="text-muted-foreground">Entry Date:</span>
            <span>{formatDate(vehicle.entry_time)}</span>
            <span className="text-muted-foreground">Entry Time:</span>
            <span>{formatTime(vehicle.entry_time)}</span>
            <span className="text-muted-foreground">Exit Date:</span>
            <span>{formatDate(now)}</span>
            <span className="text-muted-foreground">Exit Time:</span>
            <span>{formatTime(now)}</span>
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{formatDuration(new Date(vehicle.entry_time), now)}</span>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <h4 className="font-semibold">Billing Breakdown</h4>
            <div className="grid grid-cols-2 gap-1">
              <span>Duration:</span><span>{formatDuration(new Date(vehicle.entry_time), now)}</span>
              <span>Billable Days:</span><span>{bill.billableDays}</span>
              <span>Gross Amount:</span><span>{formatINR(bill.grossAmount)}</span>
              {bill.advanceDeduction > 0 && (
                <>
                  <span>Advance Paid:</span><span className="text-success">−{formatINR(bill.advanceDeduction)}</span>
                </>
              )}
              <span className="font-bold text-base pt-1">Balance Due:</span>
              <span className={`font-bold text-base pt-1 ${bill.balanceDue === 0 ? "text-success" : "text-destructive"}`}>
                {formatINR(bill.balanceDue)}
              </span>
            </div>
            {bill.balanceDue === 0 && bill.advanceDeduction > 0 && (
              <p className="text-success text-xs mt-2">Advance fully covers this stay. No additional charge.</p>
            )}
          </div>

          {bill.balanceDue > 0 && (
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
          )}

          <Button className="w-full" size="lg" onClick={handleExit} disabled={loading}>
            {loading ? "Processing..." : "Complete Exit & Generate Receipt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
