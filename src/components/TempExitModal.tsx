import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { formatDateTime, formatDuration, formatINR, calculateBill } from "@/utils/pricing";
import { AlertTriangle, BadgeCheck, Wallet } from "lucide-react";

interface TempExitModalProps {
  vehicle: any;
  mode: "temp-exit" | "return";
  onClose: () => void;
  onComplete: () => void;
}

export default function TempExitModal({ vehicle, mode, onClose, onComplete }: TempExitModalProps) {
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const entryTime = new Date(vehicle.entry_time);
  const bill = calculateBill(entryTime, now, vehicle.daily_rate, vehicle.advance_paid ?? false);

  // Rest-hours setting (defaults 4)
  const { data: restHours = 4 } = useQuery({
    queryKey: ["tempExitRestHours"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("temp_exit_rest_hours" as any).limit(1).single();
      return ((data as any)?.temp_exit_rest_hours as number) ?? 4;
    },
  });

  // ---- temp-exit payment state ----
  const advanceAmount = vehicle.advance_amount ?? 0;
  const advancePaid = !!vehicle.advance_paid;
  const alreadyCollectedTemp = vehicle.temp_exit_payment_amount ?? 0;
  const suggestedDue = Math.max(0, bill.grossAmount - advanceAmount - alreadyCollectedTemp);

  const [collectAmount, setCollectAmount] = useState<string>(String(suggestedDue));
  const [payMode, setPayMode] = useState<string>(vehicle.payment_mode || "Cash");

  // Time-window evaluation for return-mode warnings
  const tempExitAt = vehicle.temp_exit_time ? new Date(vehicle.temp_exit_time) : null;
  const minutesAway = tempExitAt ? (now.getTime() - tempExitAt.getTime()) / 60000 : 0;
  const restMinutesAllowed = restHours * 60;
  const restWindowExceeded = !!tempExitAt && minutesAway > restMinutesAllowed;

  const handleTempExit = async () => {
    setLoading(true);
    const amt = Math.max(0, parseInt(collectAmount) || 0);
    const tempExitISO = now.toISOString();

    const update: any = {
      is_temporarily_out: true,
      temp_exit_time: tempExitISO,
      return_time: null,
    };
    if (amt > 0) {
      update.temp_exit_payment_amount = alreadyCollectedTemp + amt;
      update.temp_exit_payment_mode = payMode;
      update.temp_exit_payment_at = tempExitISO;
    }

    const { error } = await supabase.from("active_vehicles").update(update).eq("id", vehicle.id);
    if (error) {
      toast.error("Failed: " + error.message);
      setLoading(false);
      return;
    }

    if (amt > 0) {
      await supabase.from("payments").insert({
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.vehicle_number,
        payment_type: "TempExit",
        amount: amt,
        payment_mode: payMode,
        notes: `Collected at temp exit (${formatDateTime(now)})`,
      });
    }

    toast.success(
      amt > 0
        ? `${vehicle.vehicle_number} marked out — ${formatINR(amt)} collected`
        : `${vehicle.vehicle_number} marked as temporarily out`,
    );
    onComplete();
    setLoading(false);
  };

  const handleReturn = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("active_vehicles")
      .update({
        is_temporarily_out: false,
        return_time: now.toISOString(),
      })
      .eq("id", vehicle.id);

    if (error) toast.error("Failed: " + error.message);
    else {
      toast.success(`${vehicle.vehicle_number} has returned`);
      onComplete();
    }
    setLoading(false);
  };

  if (mode === "temp-exit") {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Temporary Exit — {vehicle.vehicle_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {advancePaid && (
              <div className="bg-success/10 border border-success/30 rounded-lg p-3 flex items-start gap-2">
                <BadgeCheck className="w-4 h-4 text-success mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-success">Advance Payment Already Collected</p>
                  <p className="text-muted-foreground">
                    {formatINR(advanceAmount)} on file — deducted from amount due.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Vehicle:</span>
              <span className="font-mono font-bold">{vehicle.vehicle_number}</span>
              <span className="text-muted-foreground">Category:</span>
              <span>{vehicle.pricing_category}</span>
              <span className="text-muted-foreground">Entry:</span>
              <span>{formatDateTime(vehicle.entry_time)}</span>
              <span className="text-muted-foreground">Temp Exit:</span>
              <span>{formatDateTime(now)}</span>
              <span className="text-muted-foreground">Stayed So Far:</span>
              <span className="font-medium">{formatDuration(entryTime, now)}</span>
            </div>

            <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between"><span>Billable Days:</span><span>{bill.billableDays}</span></div>
              <div className="flex justify-between"><span>Gross Charges:</span><span>{formatINR(bill.grossAmount)}</span></div>
              {advanceAmount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Advance Deduction:</span><span>−{formatINR(advanceAmount)}</span>
                </div>
              )}
              {alreadyCollectedTemp > 0 && (
                <div className="flex justify-between text-success">
                  <span>Already Collected:</span><span>−{formatINR(alreadyCollectedTemp)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1 mt-1">
                <span>Net Amount Due:</span>
                <span className={suggestedDue === 0 ? "text-success" : "text-destructive"}>
                  {formatINR(suggestedDue)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Collect Payment Now
              </Label>
              <Input
                type="number"
                min="0"
                value={collectAmount}
                onChange={e => setCollectAmount(e.target.value)}
                placeholder="0 to skip"
              />
              {parseInt(collectAmount) > 0 && (
                <RadioGroup value={payMode} onValueChange={setPayMode} className="flex gap-4 pt-1">
                  {["Cash", "UPI", "Card"].map(m => (
                    <div key={m} className="flex items-center space-x-2">
                      <RadioGroupItem value={m} id={`tx-${m}`} />
                      <Label htmlFor={`tx-${m}`} className="cursor-pointer text-sm">{m}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              <p className="text-xs text-muted-foreground">
                Vehicle must return within {restHours} hour{restHours === 1 ? "" : "s"} of temp exit.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button
                className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={handleTempExit}
                disabled={loading}
              >
                {loading ? "Processing..." : "Confirm Temp Exit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---- Return mode ----
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Vehicle — {vehicle.vehicle_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {restWindowExceeded && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Rest hours exceeded</p>
                <p className="text-muted-foreground">
                  Allowed {restHours}h — vehicle was away for {formatDuration(tempExitAt!, now)}.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Vehicle:</span>
            <span className="font-mono font-bold">{vehicle.vehicle_number}</span>
            <span className="text-muted-foreground">Entry:</span>
            <span>{formatDateTime(vehicle.entry_time)}</span>
            <span className="text-muted-foreground">Temp Exit:</span>
            <span>{tempExitAt ? formatDateTime(tempExitAt) : "—"}</span>
            <span className="text-muted-foreground">Re-entry (now):</span>
            <span>{formatDateTime(now)}</span>
            <span className="text-muted-foreground">Time Away:</span>
            <span>{tempExitAt ? formatDuration(tempExitAt, now) : "—"}</span>
            {alreadyCollectedTemp > 0 && (
              <>
                <span className="text-muted-foreground">Paid at Temp Exit:</span>
                <span className="text-success font-medium">{formatINR(alreadyCollectedTemp)}</span>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleReturn} disabled={loading}>
              {loading ? "Processing..." : "Confirm Re-entry"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
