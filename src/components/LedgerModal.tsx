import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatINR, formatDateTime, calculateBill, formatDuration } from "@/utils/pricing";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

interface LedgerModalProps {
  vehicle: any;
  onClose: () => void;
}

export default function LedgerModal({ vehicle, onClose }: LedgerModalProps) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
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
  const bill = calculateBill(new Date(vehicle.entry_time), now, vehicle.daily_rate, vehicle.advance_paid ?? false);
  const recordedPaid = payments.reduce((s, p: any) => s + (p.amount ?? 0), 0);
  // Safety net: if advance was paid on entry but no Advance ledger row exists, count it anyway.
  const hasAdvanceRow = payments.some((p: any) => p.payment_type === "Advance");
  const advanceFallback = vehicle.advance_paid && !hasAdvanceRow ? (vehicle.advance_amount ?? 0) : 0;
  const totalPaid = recordedPaid + advanceFallback;
  const outstanding = Math.max(0, bill.grossAmount - totalPaid);

  let running = 0;

  const handleAddPayment = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!mode) { toast.error("Please select the payment mode before continuing"); return; }
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      vehicle_id: vehicle.id,
      vehicle_number: vehicle.vehicle_number,
      payment_type: "Partial",
      amount: amt,
      payment_mode: mode,
      notes: note || null,
    });
    setSaving(false);
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success(`Payment of ${formatINR(amt)} added`);
    setAmount(""); setMode(""); setNote(""); setShowAdd(false);
    queryClient.invalidateQueries({ queryKey: ["ledger", vehicle.id] });
    queryClient.invalidateQueries({ queryKey: ["paidByActiveVehicle"] });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Ledger — {vehicle.vehicle_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="bg-muted p-2 rounded">
              <p className="text-xs text-muted-foreground">Stay so far</p>
              <p className="font-semibold">{formatDuration(new Date(vehicle.entry_time), now)}</p>
            </div>
            <div className="bg-muted p-2 rounded">
              <p className="text-xs text-muted-foreground">Charged ({bill.billableDays}d)</p>
              <p className="font-semibold">{formatINR(bill.grossAmount)}</p>
            </div>
            <div className="bg-success/10 p-2 rounded">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="font-semibold text-success">{formatINR(totalPaid)}</p>
            </div>
            <div className={`p-2 rounded ${outstanding > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className={`font-semibold ${outstanding > 0 ? "text-destructive" : "text-success"}`}>
                {formatINR(outstanding)}
              </p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs">
                <tr>
                  <th className="p-2">When</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Mode</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-right">Running Paid</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No payments yet.</td></tr>
                ) : (
                  payments.map((p: any) => {
                    running += p.amount ?? 0;
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{p.paid_at ? formatDateTime(p.paid_at) : "—"}</td>
                        <td className="p-2"><Badge variant="secondary">{p.payment_type}</Badge></td>
                        <td className="p-2">{p.payment_mode}</td>
                        <td className="p-2 text-right font-medium">{formatINR(p.amount)}</td>
                        <td className="p-2 text-right text-muted-foreground">{formatINR(running)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {payments.some((p: any) => p.notes) && (
            <div className="text-xs space-y-1">
              <p className="font-semibold">Notes</p>
              {payments.filter((p: any) => p.notes).map((p: any) => (
                <p key={p.id} className="text-muted-foreground">
                  • <span className="font-mono">{formatDateTime(p.paid_at)}</span> — {p.notes}
                </p>
              ))}
            </div>
          )}

          {showAdd ? (
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Add Payment</p>
                <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setAmount(""); setMode(""); setNote(""); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs">Amount</Label>
                <Input type="number" min={1} step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
                {outstanding > 0 && (
                  <button type="button" className="text-xs text-primary mt-1" onClick={() => setAmount(String(outstanding))}>
                    Use outstanding {formatINR(outstanding)}
                  </button>
                )}
              </div>
              <div>
                <Label className="text-xs">Payment Mode (required)</Label>
                <RadioGroup value={mode} onValueChange={setMode} className="flex gap-4 mt-1">
                  {["Cash", "UPI", "Card"].map(m => (
                    <div key={m} className="flex items-center space-x-2">
                      <RadioGroupItem value={m} id={`add-${m}`} />
                      <Label htmlFor={`add-${m}`} className="cursor-pointer">{m}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Interim collection..." />
              </div>
              <Button className="w-full" onClick={handleAddPayment} disabled={saving || !amount || !mode}>
                {saving ? "Saving..." : "Save Payment"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Payment
            </Button>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
