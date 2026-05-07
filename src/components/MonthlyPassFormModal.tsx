import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getMonthlyPrice, generatePassId, computeExpiry } from "@/utils/monthlyPass";
import { formatINR } from "@/utils/pricing";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { Info, AlertCircle } from "lucide-react";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";

interface Props {
  mode: "create" | "renew";
  pass?: any;
  onClose: () => void;
  onSuccess: (pass: any) => void;
}

export default function MonthlyPassFormModal({ mode, pass, onClose, onSuccess }: Props) {
  const isRenew = mode === "renew";
  const [vehicleNumber, setVehicleNumber] = useState(pass?.vehicle_number ?? "");
  const [ownerName, setOwnerName] = useState(pass?.owner_name ?? "");
  const [ownerMobile, setOwnerMobile] = useState(pass?.owner_mobile ?? "");
  const [numWheels, setNumWheels] = useState(pass?.num_wheels ? String(pass.num_wheels) : "");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [loading, setLoading] = useState(false);

  const wheels = parseInt(numWheels) || 0;
  const pricing = wheels > 0 ? getMonthlyPrice(wheels) : null;
  const validMobile = /^[6-9]\d{9}$/.test(ownerMobile);
  const showWheelError = numWheels !== "" && !pricing;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricing) return toast.error("Invalid wheel count");
    if (!validMobile) return toast.error("Enter valid 10-digit mobile starting with 6-9");

    const formattedVehicle = vehicleNumber.toUpperCase().trim();
    if (!formattedVehicle) return toast.error("Enter vehicle number");

    setLoading(true);

    if (isRenew && pass) {
      // Extend expiry: from later of (now, current expiry)
      const base = new Date(pass.pass_expiry_date) > new Date() ? new Date(pass.pass_expiry_date) : new Date();
      const newExpiry = addDays(base, 30);
      const { data, error } = await supabase.from("monthly_passes").update({
        pass_expiry_date: newExpiry.toISOString(),
        num_wheels: wheels,
        pricing_category: pricing.category,
        daily_rate: pricing.dailyRate,
        amount: pricing.monthlyAmount,
        payment_status: paymentStatus,
        payment_mode: paymentMode,
        owner_name: ownerName || null,
        owner_mobile: ownerMobile,
        is_active: true,
      }).eq("id", pass.id).select().single();
      if (error) { toast.error(error.message); setLoading(false); return; }

      if (paymentStatus === "Paid") {
        await supabase.from("payments").insert({
          vehicle_number: formattedVehicle,
          payment_type: "Monthly Pass Renewal",
          amount: pricing.monthlyAmount,
          payment_mode: paymentMode,
          notes: `Pass ${pass.pass_id} renewed`,
        });
      }
      toast.success("Pass renewed");
      setLoading(false);
      onSuccess(data);
      return;
    }

    // Create: ensure no active duplicate
    const { data: existing } = await supabase
      .from("monthly_passes")
      .select("id")
      .eq("vehicle_number", formattedVehicle)
      .eq("is_active", true)
      .maybeSingle();
    if (existing) {
      toast.error(`An active monthly pass already exists for ${formattedVehicle}`);
      setLoading(false);
      return;
    }

    const passId = generatePassId();
    const start = new Date();
    const expiry = computeExpiry(start);
    const { data, error } = await supabase.from("monthly_passes").insert({
      pass_id: passId,
      vehicle_number: formattedVehicle,
      owner_name: ownerName || null,
      owner_mobile: ownerMobile,
      num_wheels: wheels,
      pricing_category: pricing.category,
      daily_rate: pricing.dailyRate,
      amount: pricing.monthlyAmount,
      pass_start_date: start.toISOString(),
      pass_expiry_date: expiry.toISOString(),
      payment_status: paymentStatus,
      payment_mode: paymentMode,
      is_active: true,
    }).select().single();

    if (error) { toast.error(error.message); setLoading(false); return; }

    if (paymentStatus === "Paid") {
      await supabase.from("payments").insert({
        vehicle_number: formattedVehicle,
        payment_type: "Monthly Pass",
        amount: pricing.monthlyAmount,
        payment_mode: paymentMode,
        notes: `Pass ${passId} issued`,
      });
    }

    toast.success(`Monthly pass ${passId} created`);
    setLoading(false);
    onSuccess(data);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isRenew ? "Renew Monthly Pass" : "Create Monthly Pass"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Vehicle Number</Label>
            <Input
              value={vehicleNumber}
              onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="MH-12-AB-1234"
              className="font-mono"
              disabled={isRenew}
              required
            />
          </div>
          <div>
            <Label>Owner Name (optional)</Label>
            <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} />
          </div>
          <div>
            <Label>Owner Mobile</Label>
            <Input
              value={ownerMobile}
              onChange={e => setOwnerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="9876543210"
              required
            />
            {ownerMobile && !validMobile && (
              <p className="text-destructive text-xs mt-1">Must be 10 digits starting with 6-9</p>
            )}
          </div>
          <div>
            <Label>Number of Wheels</Label>
            <Input type="number" min={2} value={numWheels} onChange={e => setNumWheels(e.target.value)} required />
            {pricing && (
              <div className="mt-2 p-2 bg-primary/10 border border-primary/20 rounded text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                {pricing.category} • {formatINR(pricing.dailyRate)}/day • <strong>{formatINR(pricing.monthlyAmount)}/month</strong>
              </div>
            )}
            {showWheelError && (
              <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Invalid wheel count
              </div>
            )}
          </div>
          <div>
            <Label>Payment Mode</Label>
            <RadioGroup value={paymentMode} onValueChange={setPaymentMode} className="flex gap-4 mt-1">
              {["Cash", "UPI", "Card"].map(m => (
                <div key={m} className="flex items-center gap-1">
                  <RadioGroupItem value={m} id={`pm-${m}`} />
                  <Label htmlFor={`pm-${m}`} className="cursor-pointer">{m}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label>Payment Status</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Due">Due</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading || !pricing} className="flex-1">
              {loading ? "Saving..." : isRenew ? "Renew Pass" : "Create Pass"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
