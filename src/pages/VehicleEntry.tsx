import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getPricingDetails, getValidWheelCounts, formatINR, formatDateTime } from "@/utils/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Truck, Info, AlertCircle } from "lucide-react";
import EntryTokenModal from "@/components/EntryTokenModal";

export default function VehicleEntry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [numWheels, setNumWheels] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [advancePaid, setAdvancePaid] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("Due");
  const [notes, setNotes] = useState("");
  const [entryToken, setEntryToken] = useState<any>(null);
  const wheels = parseInt(numWheels) || 0;
  const pricing = wheels > 0 ? getPricingDetails(wheels) : null;
  const isInvalidWheels = wheels > 0 && wheels !== 4 && wheels !== 6 && !(wheels >= 7);
  const showWheelError = numWheels !== "" && !pricing && wheels > 0;

  const validateMobile = (m: string) => /^[6-9]\d{9}$/.test(m);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricing) { toast.error("Invalid wheel count"); return; }
    if (!validateMobile(driverMobile)) { toast.error("Enter valid 10-digit mobile number starting with 6-9"); return; }

    const formattedVehicle = vehicleNumber.toUpperCase().trim();
    if (!formattedVehicle) { toast.error("Enter vehicle number"); return; }

    setLoading(true);

    // Check duplicate
    const { data: existing } = await supabase.from("active_vehicles").select("id").eq("vehicle_number", formattedVehicle).maybeSingle();
    if (existing) {
      toast.error(`Vehicle ${formattedVehicle} is already in the parking. Please process exit first.`);
      setLoading(false);
      return;
    }

    const finalPaymentStatus = advancePaid ? "Paid" : paymentStatus;
    const advanceAmount = advancePaid ? pricing.dailyRate : 0;

    const { data: vehicle, error } = await supabase.from("active_vehicles").insert({
      vehicle_number: formattedVehicle,
      driver_mobile: driverMobile,
      num_wheels: wheels,
      pricing_category: pricing.category,
      daily_rate: pricing.dailyRate,
      payment_mode: paymentMode,
      advance_paid: advancePaid,
      advance_amount: advanceAmount,
      payment_status: finalPaymentStatus,
      notes: notes || null,
    }).select().single();

    if (error) {
      toast.error("Failed to register: " + error.message);
      setLoading(false);
      return;
    }

    // Record advance payment
    if (advancePaid && vehicle) {
      await supabase.from("payments").insert({
        vehicle_id: vehicle.id,
        vehicle_number: formattedVehicle,
        payment_type: "Advance",
        amount: advanceAmount,
        payment_mode: paymentMode,
      });
    }

    toast.success(`Vehicle ${formattedVehicle} registered successfully`);
    setLoading(false);
    navigate("/active-vehicles");
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 md:pb-0">
      <h1 className="text-2xl font-bold mb-6">New Vehicle Entry</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Truck className="w-5 h-5" /> Vehicle Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vehicleNumber">Vehicle Number</Label>
              <Input id="vehicleNumber" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value.toUpperCase())} placeholder="MH-12-AB-1234" className="font-mono" required />
            </div>
            <div>
              <Label htmlFor="mobile">Driver Mobile</Label>
              <Input id="mobile" value={driverMobile} onChange={e => setDriverMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="9876543210" required />
              {driverMobile && !validateMobile(driverMobile) && (
                <p className="text-destructive text-xs mt-1">Must be 10 digits starting with 6-9</p>
              )}
            </div>
            <div>
              <Label htmlFor="wheels">Number of Wheels</Label>
              <Input id="wheels" type="number" min={4} value={numWheels} onChange={e => setNumWheels(e.target.value)} placeholder="e.g. 6, 10, 14" required />
              {pricing && (
                <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Category: {pricing.category} | Rate: {formatINR(pricing.dailyRate)}/day</span>
                </div>
              )}
              {showWheelError && (
                <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">Invalid wheel count. Accepted: {getValidWheelCounts()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Payment Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Payment Mode</Label>
              <RadioGroup value={paymentMode} onValueChange={setPaymentMode} className="flex gap-4 mt-2">
                {["Cash", "UPI", "Card"].map(m => (
                  <div key={m} className="flex items-center space-x-2">
                    <RadioGroupItem value={m} id={`mode-${m}`} />
                    <Label htmlFor={`mode-${m}`} className="cursor-pointer">{m}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <Label htmlFor="advance" className="cursor-pointer">Collect 1-Day Advance</Label>
                {advancePaid && pricing && (
                  <p className="text-sm text-success font-medium mt-1">Advance: {formatINR(pricing.dailyRate)}</p>
                )}
              </div>
              <Switch id="advance" checked={advancePaid} onCheckedChange={setAdvancePaid} />
            </div>

            {!advancePaid && (
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
            )}

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special notes..." />
            </div>
          </CardContent>
        </Card>

        {pricing && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">Entry Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Entry Time:</span>
                <span>{formatDateTime(new Date())}</span>
                <span className="text-muted-foreground">Daily Rate:</span>
                <span className="font-semibold">{formatINR(pricing.dailyRate)}</span>
                <span className="text-muted-foreground">Advance:</span>
                <span>{advancePaid ? formatINR(pricing.dailyRate) : "None"}</span>
                <span className="text-muted-foreground">Status:</span>
                <span className={advancePaid || paymentStatus === "Paid" ? "text-success font-medium" : "text-warning font-medium"}>
                  {advancePaid ? "Paid" : paymentStatus}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={loading || !pricing}>
          {loading ? "Registering..." : "Register Vehicle Entry"}
        </Button>
      </form>
    </div>
  );
}
