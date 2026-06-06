import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/utils/pricing";
import { format } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  shift: any;
  onClose: () => void;
  onClosed: () => void;
}

export default function ShiftHandoverDialog({ shift, onClose, onClosed }: Props) {
  const qc = useQueryClient();
  const [counted, setCounted] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const startAt = shift.start_at;
  const endAt = new Date().toISOString();

  const { data: settings } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*").limit(1).single();
      return data;
    },
  });
  const threshold = (settings as any)?.cash_variance_threshold ?? 100;

  const { data: payments = [] } = useQuery({
    queryKey: ["shiftPayments", shift.id, endAt],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .gte("paid_at", startAt)
        .lte("paid_at", endAt);
      return data ?? [];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["shiftEntries", shift.id, endAt],
    queryFn: async () => {
      const [a, h] = await Promise.all([
        supabase.from("active_vehicles").select("vehicle_number, entry_time, pricing_category").gte("entry_time", startAt).lte("entry_time", endAt),
        supabase.from("vehicle_history").select("vehicle_number, entry_time, pricing_category").gte("entry_time", startAt).lte("entry_time", endAt),
      ]);
      return [...(a.data ?? []), ...(h.data ?? [])];
    },
  });

  const { data: exits = [] } = useQuery({
    queryKey: ["shiftExits", shift.id, endAt],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicle_history")
        .select("vehicle_number, exit_time, gross_amount, pricing_category")
        .gte("exit_time", startAt)
        .lte("exit_time", endAt);
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const sumByMode = (m: string) => payments.filter((p: any) => p.payment_mode === m).reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    return {
      cash: sumByMode("Cash"),
      upi: sumByMode("UPI"),
      card: sumByMode("Card"),
      total: payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0),
    };
  }, [payments]);

  const countedNum = parseFloat(counted) || 0;
  const variance = countedNum - totals.cash;
  const varianceOk = Math.abs(variance) <= threshold;

  const generatePdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Shift Handover Report", 14, 18);
    doc.setFontSize(10);
    doc.text(`Operator: ${shift.operator_name}`, 14, 26);
    doc.text(`Start: ${format(new Date(startAt), "dd MMM yyyy HH:mm")}`, 14, 32);
    doc.text(`End:   ${format(new Date(endAt), "dd MMM yyyy HH:mm")}`, 14, 38);

    autoTable(doc, {
      startY: 44,
      head: [["Metric", "Value"]],
      body: [
        ["Entries", String(entries.length)],
        ["Exits", String(exits.length)],
        ["Cash collected", formatINR(totals.cash)],
        ["UPI collected", formatINR(totals.upi)],
        ["Card collected", formatINR(totals.card)],
        ["Total revenue", formatINR(totals.total)],
        ["Counted cash", formatINR(countedNum)],
        ["Variance", formatINR(variance)],
      ],
    });

    const afterTotals = (doc as any).lastAutoTable.finalY + 8;
    if (notes) {
      doc.setFontSize(10);
      doc.text(`Notes: ${notes}`, 14, afterTotals);
    }

    const sigY = afterTotals + 30;
    doc.line(14, sigY, 80, sigY);
    doc.line(120, sigY, 186, sigY);
    doc.setFontSize(9);
    doc.text("Operator Signature", 14, sigY + 5);
    doc.text("Supervisor Signature", 120, sigY + 5);

    doc.save(`Shift_Handover_${shift.operator_name}_${format(new Date(endAt), "yyyyMMdd_HHmm")}.pdf`);
  };

  const submit = async () => {
    if (!counted) {
      toast.error("Enter counted cash before closing the shift");
      return;
    }
    setSubmitting(true);
    const reconErr = await supabase.from("cash_reconciliations").insert({
      shift_id: shift.id,
      operator_name: shift.operator_name,
      expected_cash: totals.cash,
      counted_cash: countedNum,
      variance,
      notes: notes || null,
      locked_at: new Date().toISOString(),
    });
    if (reconErr.error) {
      toast.error("Reconciliation failed: " + reconErr.error.message);
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from("shifts")
      .update({ status: "closed", end_at: endAt, notes: notes || null })
      .eq("id", shift.id);
    if (error) {
      toast.error("Close shift failed: " + error.message);
      setSubmitting(false);
      return;
    }

    generatePdf();
    toast.success("Shift closed and handover PDF generated");
    qc.invalidateQueries({ queryKey: ["currentShift"] });
    qc.invalidateQueries({ queryKey: ["shiftsList"] });
    qc.invalidateQueries({ queryKey: ["reconciliations"] });
    onClosed();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>End Shift & Cash Reconciliation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-md text-sm space-y-1">
            <p><span className="text-muted-foreground">Operator:</span> <span className="font-semibold">{shift.operator_name}</span></p>
            <p><span className="text-muted-foreground">Started:</span> {format(new Date(startAt), "dd MMM yyyy HH:mm")}</p>
            <p><span className="text-muted-foreground">Duration:</span> {Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)} min</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Entries" value={String(entries.length)} />
            <Stat label="Exits" value={String(exits.length)} />
            <Stat label="Transactions" value={String(payments.length)} />
            <Stat label="Total Revenue" value={formatINR(totals.total)} />
          </div>

          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Mode</th>
                  <th className="p-2 text-right">Collected</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="p-2">Cash</td><td className="p-2 text-right font-mono">{formatINR(totals.cash)}</td></tr>
                <tr className="border-t"><td className="p-2">UPI</td><td className="p-2 text-right font-mono">{formatINR(totals.upi)}</td></tr>
                <tr className="border-t"><td className="p-2">Card</td><td className="p-2 text-right font-mono">{formatINR(totals.card)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <Label>Counted Cash (₹)</Label>
            <Input type="number" min={0} value={counted} onChange={e => setCounted(e.target.value)} placeholder="0" />
          </div>

          {counted && (
            <div className={`p-3 rounded-md flex items-start gap-2 ${varianceOk ? "bg-success/10" : "bg-destructive/10"}`}>
              {varianceOk ? <CheckCircle2 className="w-5 h-5 text-success mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />}
              <div className="text-sm">
                <p className="font-semibold">Variance: {formatINR(variance)}</p>
                <p className="text-xs text-muted-foreground">
                  Expected {formatINR(totals.cash)} · Counted {formatINR(countedNum)} · Threshold ±{formatINR(threshold)}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Variance reason, incidents, handover remarks…" />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={submitting || !counted}>
              {submitting ? "Closing…" : "Close Shift & Print PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border rounded-md p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
