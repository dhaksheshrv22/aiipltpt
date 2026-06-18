import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format } from "date-fns";
import { getPricingDetails, formatINR } from "@/utils/pricing";

interface EditVehicleModalProps {
  vehicle: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditVehicleModal({ vehicle, onClose, onSaved }: EditVehicleModalProps) {
  const entryDate = new Date(vehicle.entry_time);
  const [date, setDate] = useState(format(entryDate, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(entryDate, "HH:mm"));
  const [driverMobile, setDriverMobile] = useState(vehicle.driver_mobile);
  const [vehicleNumber, setVehicleNumber] = useState(vehicle.vehicle_number);
  const [numWheels, setNumWheels] = useState(String(vehicle.num_wheels));
  const [paymentMode, setPaymentMode] = useState<string>(vehicle.payment_mode || "Cash");
  const [advancePaid, setAdvancePaid] = useState<boolean>(!!vehicle.advance_paid);
  const [advanceAmount, setAdvanceAmount] = useState<string>(String(vehicle.advance_amount ?? 0));
  const [txnRef, setTxnRef] = useState<string>("");
  const [notes, setNotes] = useState(vehicle.notes ?? "");
  const [saving, setSaving] = useState(false);

  const wheels = parseInt(numWheels) || 0;
  const pricing = useMemo(() => (wheels > 0 ? getPricingDetails(wheels) : null), [wheels]);

  const handleSave = async () => {
    if (!date || !time) { toast.error("Date and time are required"); return; }
    if (!pricing) { toast.error("Invalid wheel count"); return; }
    if (!/^[6-9]\d{9}$/.test(driverMobile.trim())) {
      toast.error("Mobile must be 10 digits starting with 6-9");
      return;
    }

    const newEntryTime = new Date(`${date}T${time}:00`);
    if (isNaN(newEntryTime.getTime())) { toast.error("Invalid date/time"); return; }
    if (newEntryTime > new Date()) { toast.error("Entry time cannot be in the future"); return; }

    const advAmt = advancePaid ? (parseInt(advanceAmount) || pricing.dailyRate) : 0;

    setSaving(true);

    const update: any = {
      entry_time: newEntryTime.toISOString(),
      driver_mobile: driverMobile.trim(),
      vehicle_number: vehicleNumber.trim().toUpperCase(),
      num_wheels: wheels,
      pricing_category: pricing.category,
      daily_rate: vehicle.is_monthly_pass ? 0 : pricing.dailyRate,
      payment_mode: paymentMode,
      advance_paid: advancePaid,
      advance_amount: advAmt,
      notes: notes.trim() || null,
    };

    const { error } = await supabase.from("active_vehicles").update(update).eq("id", vehicle.id);
    if (error) { setSaving(false); toast.error("Failed to update: " + error.message); return; }

    // Sync the original Advance payment row (if any) so reports stay accurate.
    const { data: existingAdv } = await supabase
      .from("payments")
      .select("id")
      .eq("vehicle_id", vehicle.id)
      .eq("payment_type", "Advance")
      .maybeSingle();

    if (advancePaid && advAmt > 0) {
      const advancePayload: any = {
        amount: advAmt,
        payment_mode: paymentMode,
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        notes: txnRef.trim() ? `Txn Ref: ${txnRef.trim()}` : null,
        paid_at: newEntryTime.toISOString(),
      };
      if (existingAdv) {
        await supabase.from("payments").update(advancePayload).eq("id", existingAdv.id);
      } else {
        await supabase.from("payments").insert({
          ...advancePayload,
          vehicle_id: vehicle.id,
          payment_type: "Advance",
        });
      }
    } else if (existingAdv) {
      await supabase.from("payments").delete().eq("id", existingAdv.id);
    }

    setSaving(false);
    toast.success("Vehicle updated successfully");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Vehicle — {vehicle.vehicle_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="vehicleNum">Vehicle Number</Label>
            <Input id="vehicleNum" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} className="font-mono uppercase" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wheels">Wheels</Label>
              <Input id="wheels" type="number" min={2} value={numWheels} onChange={e => setNumWheels(e.target.value)} />
              {pricing && (
                <p className="text-xs text-muted-foreground mt-1">{pricing.category} · {formatINR(pricing.dailyRate)}/day</p>
              )}
            </div>
            <div>
              <Label htmlFor="driverMob">Driver Mobile</Label>
              <Input id="driverMob" value={driverMobile} onChange={e => setDriverMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="tel" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="entryDate">Entry Date</Label>
              <Input id="entryDate" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="entryTime">Entry Time</Label>
              <Input id="entryTime" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <Label className="text-sm font-semibold">Payment Details</Label>
            <div>
              <Label className="text-xs">Payment Mode</Label>
              <RadioGroup value={paymentMode} onValueChange={setPaymentMode} className="flex gap-4 mt-1">
                {["Cash", "UPI", "Card"].map(m => (
                  <div key={m} className="flex items-center space-x-2">
                    <RadioGroupItem value={m} id={`ed-${m}`} />
                    <Label htmlFor={`ed-${m}`} className="cursor-pointer text-sm">{m}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted rounded">
              <Label htmlFor="adv" className="cursor-pointer text-sm">Advance Paid</Label>
              <Switch id="adv" checked={advancePaid} onCheckedChange={setAdvancePaid} />
            </div>

            {advancePaid && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="advAmt" className="text-xs">Advance Amount (₹)</Label>
                  <Input id="advAmt" type="number" min={0} value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="txn" className="text-xs">Txn Reference (optional)</Label>
                  <Input id="txn" value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="UPI / Card ref" />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
