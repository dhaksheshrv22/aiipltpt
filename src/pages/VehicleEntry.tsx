import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getPricingDetails, getValidWheelCounts, formatINR, formatDateTime, formatDate, formatDuration } from "@/utils/pricing";
import { getPassStatus } from "@/utils/monthlyPass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Truck, Info, AlertCircle, BadgeCheck, Repeat, ChevronDown, ChevronUp } from "lucide-react";
const EntryTokenModal = lazy(() => import("@/components/EntryTokenModal"));
import Seo from "@/components/Seo";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";

interface HistorySuggestion {
  vehicle_number: string;
  num_wheels: number;
  pricing_category: string;
  driver_mobile: string;
  entry_time: string;
  exit_time: string;
  visit_count: number;
  all_visits: { entry_time: string; exit_time: string }[];
}

export default function VehicleEntry() {
  const navigate = useNavigate();
  const receiptSettings = useReceiptSettings();
  const [loading, setLoading] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [numWheels, setNumWheels] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [advancePaid, setAdvancePaid] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("Due");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [entryToken, setEntryToken] = useState<any>(null);
  const [activePass, setActivePass] = useState<any>(null);
  const [expiredPass, setExpiredPass] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<HistorySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAllVisits, setShowAllVisits] = useState(false);
  const wheels = parseInt(numWheels) || 0;
  const pricing = wheels > 0 ? getPricingDetails(wheels) : null;
  const showWheelError = numWheels !== "" && !pricing && wheels > 0;

  const fillFromHistory = (s: HistorySuggestion) => {
    setVehicleNumber(s.vehicle_number);
    setNumWheels(String(s.num_wheels));
    setDriverMobile(s.driver_mobile);
    setShowSuggestions(false);
    setShowAllVisits(false);
    toast.success(`Pre-filled from last visit: ${formatDate(s.exit_time)}`);
  };

  // Vehicle history autosuggest (Feature 1)
  useEffect(() => {
    const q = vehicleNumber.toUpperCase().trim();
    if (q.length < 3) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("vehicle_history")
        .select("vehicle_number, num_wheels, pricing_category, driver_mobile, entry_time, exit_time")
        .ilike("vehicle_number", `${q}%`)
        .order("exit_time", { ascending: false })
        .limit(40);
      if (!data) { setSuggestions([]); return; }
      // group by vehicle_number, keep latest
      const map = new Map<string, HistorySuggestion>();
      for (const r of data as any[]) {
        const existing = map.get(r.vehicle_number);
        if (!existing) {
          map.set(r.vehicle_number, {
            vehicle_number: r.vehicle_number,
            num_wheels: r.num_wheels,
            pricing_category: r.pricing_category,
            driver_mobile: r.driver_mobile,
            entry_time: r.entry_time,
            exit_time: r.exit_time,
            visit_count: 1,
            all_visits: [{ entry_time: r.entry_time, exit_time: r.exit_time }],
          });
        } else {
          existing.visit_count += 1;
          existing.all_visits.push({ entry_time: r.entry_time, exit_time: r.exit_time });
        }
      }
      setSuggestions(Array.from(map.values()).slice(0, 6));
    }, 250);
    return () => clearTimeout(t);
  }, [vehicleNumber]);

  const topMatch = suggestions[0];



  // Look up monthly pass when vehicle number changes
  useEffect(() => {
    const v = vehicleNumber.toUpperCase().trim();
    if (v.length < 4) { setActivePass(null); setExpiredPass(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("monthly_passes")
        .select("*")
        .eq("vehicle_number", v)
        .order("pass_expiry_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) { setActivePass(null); setExpiredPass(null); return; }
      if (getPassStatus(data.pass_expiry_date) === "Active") {
        setActivePass(data); setExpiredPass(null);
        if (!numWheels) setNumWheels(String(data.num_wheels));
        if (!driverMobile) setDriverMobile(data.owner_mobile);
      } else {
        setActivePass(null); setExpiredPass(data);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleNumber]);

  const validateMobile = (m: string) => /^[6-9]\d{9}$/.test(m);

  // Auto-fill advance amount with the daily rate when advance is turned on and field is empty/zero
  useEffect(() => {
    if (advancePaid && pricing) {
      if (advanceAmount === "" || advanceAmount === "0") {
        setAdvanceAmount(String(pricing.dailyRate));
      }
    }
  }, [advancePaid, pricing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricing) { toast.error("Invalid wheel count"); return; }
    if (!validateMobile(driverMobile)) { toast.error("Enter valid 10-digit mobile number starting with 6-9"); return; }

    const formattedVehicle = vehicleNumber.toUpperCase().trim();
    if (!formattedVehicle) { toast.error("Enter vehicle number"); return; }

    // Require payment mode confirmation only when a payment is actually being collected
    if (advancePaid && !activePass && !paymentMode) {
      toast.error("Please select the payment mode before continuing");
      return;
    }

    setLoading(true);

    // Check duplicate
    const { data: existing } = await supabase.from("active_vehicles").select("id").eq("vehicle_number", formattedVehicle).maybeSingle();
    if (existing) {
      toast.error(`Vehicle ${formattedVehicle} is already in the parking. Please process exit first.`);
      setLoading(false);
      return;
    }

    const hasActivePass = !!activePass;
    // Auto-mark Paid if user picked a payment mode (even without toggling advance)
    const autoPaid = !!paymentMode && !hasActivePass;
    const finalPaymentStatus = hasActivePass ? "Paid" : (advancePaid || autoPaid ? "Paid" : paymentStatus);
    const advanceAmount = hasActivePass ? 0 : (advancePaid ? pricing.dailyRate : 0);

    const { data: vehicle, error } = await supabase.from("active_vehicles").insert({
      vehicle_number: formattedVehicle,
      driver_mobile: driverMobile,
      num_wheels: wheels,
      pricing_category: pricing.category,
      daily_rate: hasActivePass ? 0 : pricing.dailyRate,
      payment_mode: hasActivePass ? "Monthly Pass" : (paymentMode || null),
      advance_paid: !hasActivePass && advancePaid,
      advance_amount: advanceAmount,
      payment_status: finalPaymentStatus,
      is_monthly_pass: hasActivePass,
      monthly_pass_id: hasActivePass ? activePass.id : null,
      notes: hasActivePass ? `Monthly Pass ${activePass.pass_id}${notes ? " — " + notes : ""}` : (notes || null),
    }).select().single();

    if (error) {
      const msg = (error as any).code === "23505"
        ? `Vehicle ${formattedVehicle} is already parked. Please process exit first.`
        : "Failed to register: " + error.message;
      toast.error(msg);
      setLoading(false);
      return;
    }

    // Issue sequential token number (AIIPL-YEAR-00001)
    let tokenNumber: string | null = null;
    const { data: tokenData, error: tokenErr } = await supabase.rpc("next_token_number", { _prefix: receiptSettings.prefix });
    if (tokenErr) {
      console.error("Token issue failed", tokenErr);
    } else if (tokenData) {
      tokenNumber = tokenData as unknown as string;
      await supabase.from("active_vehicles").update({ token_number: tokenNumber }).eq("id", vehicle.id);
    }

    // Record advance payment in background — don't block the token UI
    if (advancePaid && vehicle) {
      supabase.from("payments").insert({
        vehicle_id: vehicle.id,
        vehicle_number: formattedVehicle,
        payment_type: "Advance",
        amount: advanceAmount,
        payment_mode: paymentMode,
        paid_at: vehicle.entry_time,
      }).then(({ error: pErr }) => {
        if (pErr) toast.error("Advance payment log failed: " + pErr.message);
      });
    }

    toast.success(`Vehicle ${formattedVehicle} registered successfully`);
    setLoading(false);

    setEntryToken({
      vehicle_number: formattedVehicle,
      driver_mobile: driverMobile,
      num_wheels: wheels,
      pricing_category: pricing.category,
      daily_rate: pricing.dailyRate,
      entry_time: vehicle.entry_time,
      advance_paid: advancePaid,
      advance_amount: advanceAmount,
      payment_mode: paymentMode,
      payment_status: finalPaymentStatus,
      token_number: tokenNumber,
    });

  };

  return (
    <>
    {entryToken && (
      <Suspense fallback={null}>
        <EntryTokenModal
          vehicle={entryToken}
          onClose={() => {
            setEntryToken(null);
            navigate("/active-vehicles");
          }}
        />
      </Suspense>
    )}

    <div className="max-w-2xl mx-auto pb-20 md:pb-0">
      <Seo title="New Vehicle Entry" description="Register a new heavy-vehicle entry with wheel category, driver mobile, payment mode and monthly-pass lookup at the AIIPL Truck Parking Terminal." />
      <h1 className="text-2xl font-bold mb-6">New Vehicle Entry</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Truck className="w-5 h-5" /> Vehicle Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                  <Input
                    id="vehicleNumber"
                    value={vehicleNumber}
                    onChange={e => { setVehicleNumber(e.target.value.toUpperCase()); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="MH-12-AB-1234"
                    className="font-mono"
                    autoComplete="off"
                    required
                  />
                </div>
                {topMatch && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-10 whitespace-nowrap"
                    onClick={() => fillFromHistory(topMatch)}
                    title={`Re-enter ${topMatch.vehicle_number}`}
                  >
                    <Repeat className="w-3 h-3 mr-1" /> Repeat Last
                  </Button>
                )}
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-30 mt-1 w-full bg-popover border rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      type="button"
                      key={s.vehicle_number}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => fillFromHistory(s)}
                      className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold">{s.vehicle_number}</span>
                        <span className="text-[10px] text-muted-foreground">{s.visit_count} visit{s.visit_count > 1 ? "s" : ""}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.pricing_category} · 📱 {s.driver_mobile}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Last visited: {formatDate(s.exit_time)} — stayed {formatDuration(new Date(s.entry_time), new Date(s.exit_time))}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {topMatch && topMatch.visit_count > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllVisits(v => !v)}
                  className="text-xs text-primary mt-1 inline-flex items-center gap-1"
                >
                  {showAllVisits ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllVisits ? "Hide" : `View all ${topMatch.visit_count} visits`}
                </button>
              )}
              {showAllVisits && topMatch && (
                <div className="mt-2 text-xs space-y-1 bg-muted/50 p-2 rounded">
                  {topMatch.all_visits.map((v, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{formatDate(v.entry_time)} → {formatDate(v.exit_time)}</span>
                      <span>{formatDuration(new Date(v.entry_time), new Date(v.exit_time))}</span>
                    </div>
                  ))}
                </div>
              )}

              {activePass && (
                <div className="mt-2 p-3 bg-success/10 border border-success/30 rounded-lg flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium text-success">
                    Active Monthly Pass ({activePass.pass_id}) — free entry
                  </span>
                </div>
              )}
              {expiredPass && (
                <div className="mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    Monthly pass expired on {new Date(expiredPass.pass_expiry_date).toLocaleDateString()} — normal paid parking applies
                  </span>
                </div>
              )}
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
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <Label htmlFor="advance" className="cursor-pointer">Collect 1-Day Advance</Label>
                {advancePaid && pricing && (
                  <p className="text-sm text-success font-medium mt-1">Advance: {formatINR(pricing.dailyRate)}</p>
                )}
              </div>
              <Switch id="advance" checked={advancePaid} onCheckedChange={setAdvancePaid} />
            </div>

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

            <div className="text-xs text-muted-foreground">
              Payment Status is set automatically: <b>Paid</b> when a payment mode or advance is chosen, otherwise <b>Due</b>.
            </div>


            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special notes..." />
            </div>
          </CardContent>
        </Card>

        {pricing && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-3">Entry Summary</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Entry Time:</span>
                <span>{formatDateTime(new Date())}</span>
                <span className="text-muted-foreground">Daily Rate:</span>
                <span className="font-semibold">{formatINR(pricing.dailyRate)}</span>
                <span className="text-muted-foreground">Advance:</span>
                <span>{advancePaid ? formatINR(pricing.dailyRate) : "None"}</span>
                <span className="text-muted-foreground">Status:</span>
                <span className={(advancePaid || !!paymentMode || !!activePass) ? "text-success font-medium" : "text-warning font-medium"}>
                  {(advancePaid || !!paymentMode || !!activePass) ? "Paid" : "Due"}
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
    </>
  );
}
