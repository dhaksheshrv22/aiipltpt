import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { formatINR } from "@/utils/pricing";
import UpiQR from "@/components/UpiQR";

interface PaymentModalProps {
  vehicle: any;
  outstanding: number;
  onClose: () => void;
  onComplete?: () => void;
}

export default function PaymentModal({ vehicle, outstanding, onClose, onComplete }: PaymentModalProps) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>(String(outstanding > 0 ? outstanding : ""));
  const [mode, setMode] = useState<string>("Cash");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const amt = parseInt(amount) || 0;

  const submit = async () => {
    if (amt <= 0) { toast.error("Enter an amount > 0"); return; }
    setLoading(true);
    const { error } = await supabase.from("payments").insert({
      vehicle_id: vehicle.id,
      vehicle_number: vehicle.vehicle_number,
      payment_type: "Partial",
      amount: amt,
      payment_mode: mode,
      notes: note || null,
    });
    if (error) { toast.error("Failed: " + error.message); setLoading(false); return; }

    // Sync payment_status if fully covered
    const newBalance = Math.max(0, outstanding - amt);
    if (newBalance === 0 && vehicle.payment_status !== "Paid") {
      await supabase.from("active_vehicles").update({ payment_status: "Paid" }).eq("id", vehicle.id);
    }

    toast.success(`${formatINR(amt)} recorded`);
    qc.invalidateQueries({ queryKey: ["activeVehicles"] });
    qc.invalidateQueries({ queryKey: ["ledger", vehicle.id] });
    qc.invalidateQueries({ queryKey: ["outstandingDues"] });
    onComplete?.();
    onClose();
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Payment — {vehicle.vehicle_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
            <div className="flex justify-between"><span>Outstanding (est.):</span><span className="font-bold text-destructive">{formatINR(outstanding)}</span></div>
          </div>

          <div>
            <Label htmlFor="amt">Amount (₹)</Label>
            <Input id="amt" type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          <div>
            <Label>Payment Mode</Label>
            <RadioGroup value={mode} onValueChange={setMode} className="flex gap-4 mt-2">
              {["Cash", "UPI", "Card"].map(m => (
                <div key={m} className="flex items-center space-x-2">
                  <RadioGroupItem value={m} id={`pm-${m}`} />
                  <Label htmlFor={`pm-${m}`} className="cursor-pointer">{m}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {mode === "UPI" && amt > 0 && (
            <UpiQR amount={amt} vehicleNumber={vehicle.vehicle_number} />
          )}

          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Day 5 installment" rows={2} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={loading || amt <= 0}>
              {loading ? "Saving..." : `Record ${formatINR(amt)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
