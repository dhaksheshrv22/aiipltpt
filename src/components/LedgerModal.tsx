import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDateTime, calculateBill, formatDuration } from "@/utils/pricing";

interface LedgerModalProps {
  vehicle: any;
  onClose: () => void;
  onAddPayment?: () => void;
}

export default function LedgerModal({ vehicle, onClose, onAddPayment }: LedgerModalProps) {
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
  const totalPaid = payments.reduce((s, p: any) => s + (p.amount ?? 0), 0);
  const outstanding = Math.max(0, bill.grossAmount - totalPaid);

  // Running balance per row (charged - paid so far)
  let running = 0;

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

          <div className="flex gap-2 justify-end">
            {onAddPayment && (
              <Button onClick={onAddPayment}>Add Payment</Button>
            )}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
