import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/utils/pricing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  pass: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function MonthlyPassEditModal({ pass, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<Date>(new Date(pass.pass_start_date));
  const [expiryDate, setExpiryDate] = useState<Date>(new Date(pass.pass_expiry_date));
  const [paymentMode, setPaymentMode] = useState<string>(pass.payment_mode || "Cash");
  const [extraPaymentStr, setExtraPaymentStr] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: payments = [] } = useQuery({
    queryKey: ["passPayments", pass.id, pass.vehicle_number],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("vehicle_number", pass.vehicle_number)
        .in("payment_type", ["Monthly Pass", "Monthly Pass Renewal", "Monthly Pass Adjustment"])
        .order("paid_at", { ascending: true });
      return data ?? [];
    },
  });

  const alreadyPaid = useMemo(
    () => payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0),
    [payments]
  );
  const totalAmount = pass.amount ?? 0;
  const balanceBefore = Math.max(0, totalAmount - alreadyPaid);
  const extraPayment = Math.max(0, Math.min(balanceBefore, parseFloat(extraPaymentStr) || 0));
  const balanceAfter = Math.max(0, balanceBefore - extraPayment);
  const totalPaidAfter = alreadyPaid + extraPayment;

  const handleSave = async () => {
    if (expiryDate <= startDate) {
      return toast.error("Expiry date must be after start date");
    }
    setLoading(true);

    const status = totalPaidAfter >= totalAmount ? "Paid" : totalPaidAfter > 0 ? "Partial" : "Due";

    const { error } = await supabase.from("monthly_passes").update({
      pass_start_date: startDate.toISOString(),
      pass_expiry_date: expiryDate.toISOString(),
      payment_mode: paymentMode,
      payment_status: status,
    }).eq("id", pass.id);

    if (error) { toast.error(error.message); setLoading(false); return; }

    if (extraPayment > 0) {
      await supabase.from("payments").insert({
        vehicle_number: pass.vehicle_number,
        payment_type: "Monthly Pass Adjustment",
        amount: extraPayment,
        payment_mode: paymentMode,
        notes: `Pass ${pass.pass_id} — additional payment${balanceAfter > 0 ? `, ${formatINR(balanceAfter)} pending` : ""}`,
      });
    }

    toast.success("Monthly pass updated");
    queryClient.invalidateQueries({ queryKey: ["monthlyPasses"] });
    setLoading(false);
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Monthly Pass — {pass.vehicle_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            {pass.pass_id} • {pass.pricing_category} • {formatINR(totalAmount)}/month
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1")}>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(startDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1")}>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(expiryDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={expiryDate} onSelect={(d) => d && setExpiryDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label>Payment Mode</Label>
            <RadioGroup value={paymentMode} onValueChange={setPaymentMode} className="flex gap-4 mt-2">
              {["Cash", "UPI", "Card"].map(m => (
                <div key={m} className="flex items-center gap-1">
                  <RadioGroupItem value={m} id={`epm-${m}`} />
                  <Label htmlFor={`epm-${m}`} className="cursor-pointer">{m}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between"><span>Pass Amount:</span><span>{formatINR(totalAmount)}</span></div>
            <div className="flex justify-between"><span>Already Paid:</span><span className="text-success">−{formatINR(alreadyPaid)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1"><span>Outstanding:</span><span className={balanceBefore > 0 ? "text-destructive" : "text-success"}>{formatINR(balanceBefore)}</span></div>
          </div>

          <div>
            <Label>Add Payment Now</Label>
            <Input
              type="number"
              min={0}
              max={balanceBefore}
              step="1"
              value={extraPaymentStr}
              onChange={e => setExtraPaymentStr(e.target.value)}
              placeholder="0"
              className="mt-1"
              disabled={balanceBefore === 0}
            />
            {balanceBefore > 0 && (
              <div className="flex gap-2 mt-2 text-xs">
                <Button type="button" size="sm" variant="outline" onClick={() => setExtraPaymentStr(String(balanceBefore))}>
                  Full {formatINR(balanceBefore)}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setExtraPaymentStr(String(Math.round(balanceBefore / 2)))}>Half</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setExtraPaymentStr("")}>Clear</Button>
              </div>
            )}
            {extraPayment > 0 && (
              <p className="text-xs mt-2">
                After payment — Paid: <strong>{formatINR(totalPaidAfter)}</strong>
                {balanceAfter > 0 && <span className="text-warning"> • Pending {formatINR(balanceAfter)}</span>}
              </p>
            )}
          </div>

          {payments.length > 0 && (
            <div className="border rounded-lg overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr><th className="p-2 text-left">When</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Mode</th><th className="p-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">{p.paid_at ? format(new Date(p.paid_at), "dd MMM HH:mm") : "—"}</td>
                      <td className="p-2">{p.payment_type}</td>
                      <td className="p-2">{p.payment_mode}</td>
                      <td className="p-2 text-right font-medium">{formatINR(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
