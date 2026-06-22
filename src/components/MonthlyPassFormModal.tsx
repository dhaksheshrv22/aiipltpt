import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { generatePassId, computeExpiry } from "@/utils/monthlyPass";
import { formatINR } from "@/utils/pricing";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";

interface Props {
  mode: "create" | "renew";
  pass?: any;
  onClose: () => void;
  onSuccess: (pass: any) => void;
}

export default function MonthlyPassFormModal({ mode, pass, onClose, onSuccess }: Props) {
  const isRenew = mode === "renew";
  const receiptSettings = useReceiptSettings();
  const [vehicleNumber, setVehicleNumber] = useState(pass?.vehicle_number ?? "");
  const [ownerName, setOwnerName] = useState(pass?.owner_name ?? "");
  const [ownerMobile, setOwnerMobile] = useState(pass?.owner_mobile ?? "");
  const [numWheels, setNumWheels] = useState(pass?.num_wheels ? String(pass.num_wheels) : "");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);

  const wheels = parseInt(numWheels) || 0;
  const amount = Math.max(0, parseFloat(amountStr) || 0);
  const validMobile = /^[6-9]\d{9}$/.test(ownerMobile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wheels <= 0) return toast.error("Enter number of wheels");
    if (amount <= 0) return toast.error("Enter pass amount");
    if (!validMobile) return toast.error("Enter valid 10-digit mobile starting with 6-9");

    const formattedVehicle = vehicleNumber.toUpperCase().trim();
    if (!formattedVehicle) return toast.error("Enter vehicle number");

    setLoading(true);

    if (isRenew && pass) {
      const base = new Date(pass.pass_expiry_date) > new Date() ? new Date(pass.pass_expiry_date) : new Date();
      const newExpiry = addDays(base, 30);
      const { data, error } = await supabase.from("monthly_passes").update({
        pass_expiry_date: newExpiry.toISOString(),
        num_wheels: wheels,
        pricing_category: "Manual",
        daily_rate: 0,
        amount: amount,
        payment_status: "Paid",
        payment_mode: paymentMode,
        owner_name: ownerName || null,
        owner_mobile: ownerMobile,
        is_active: true,
      }).eq("id", pass.id).select().single();
      if (error) { toast.error(error.message); setLoading(false); return; }

      await supabase.from("payments").insert({
        vehicle_number: formattedVehicle,
        payment_type: "Monthly Pass Renewal",
        amount: amount,
        payment_mode: paymentMode,
        notes: `Pass ${pass.pass_id} renewed`,
      });
      toast.success("Pass renewed");
      setLoading(false);
      onSuccess(data);
      return;
    }

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

    const passId = await generatePassId(receiptSettings.prefix);
    const start = new Date();
    const expiry = computeExpiry(start);
    const { data, error } = await supabase.from("monthly_passes").insert({
      pass_id: passId,
      vehicle_number: formattedVehicle,
      owner_name: ownerName || null,
      owner_mobile: ownerMobile,
      num_wheels: wheels,
      pricing_category: "Manual",
      daily_rate: 0,
      amount: amount,
      pass_start_date: start.toISOString(),
      pass_expiry_date: expiry.toISOString(),
      payment_status: "Paid",
      payment_mode: paymentMode,
      is_active: true,
    }).select().single();

    if (error) { toast.error(error.message); setLoading(false); return; }

    await supabase.from("payments").insert({
      vehicle_number: formattedVehicle,
      payment_type: "Monthly Pass",
      amount: amount,
      payment_mode: paymentMode,
      notes: `Pass ${passId} issued`,
    });

    toast.success(`Monthly pass ${passId} created — ${formatINR(amount)} paid`);
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
            <Input
              type="number"
              min={2}
              value={numWheels}
              onChange={e => setNumWheels(e.target.value)}
              placeholder="e.g. 16"
              required
            />
          </div>
          <div>
            <Label>Pass Amount (₹)</Label>
            <Input
              type="number"
              min={1}
              step="1"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder="Enter amount"
              required
            />
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
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : isRenew ? "Renew Pass" : "Create Pass"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
