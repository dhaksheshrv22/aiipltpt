import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Receipt } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [facilityName, setFacilityName] = useState("");
  const [maxStay, setMaxStay] = useState(7);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Receipt settings
  const [receiptCompanyName, setReceiptCompanyName] = useState("AIIPL TRUCK PARKING TERMINAL");
  const [receiptHeaderText, setReceiptHeaderText] = useState("PARKING TOKEN");
  const [receiptFooterText, setReceiptFooterText] = useState("Thank you for using our facility!");
  const [receiptContactInfo, setReceiptContactInfo] = useState("");
  const [receiptPrefix, setReceiptPrefix] = useState("AIIPL");

  const { data: settings } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*").limit(1).single();
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setFacilityName(settings.facility_name ?? "");
      setMaxStay(settings.max_stay_days ?? 7);
      setReceiptCompanyName((settings as any).receipt_company_name ?? "AIIPL TRUCK PARKING TERMINAL");
      setReceiptHeaderText((settings as any).receipt_header_text ?? "PARKING TOKEN");
      setReceiptFooterText((settings as any).receipt_footer_text ?? "Thank you for using our facility!");
      setReceiptContactInfo((settings as any).receipt_contact_info ?? "");
      setReceiptPrefix((settings as any).receipt_prefix ?? "AIIPL");
    }
  }, [settings]);

  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const { error } = await supabase.from("app_settings").update({
        facility_name: facilityName,
        max_stay_days: maxStay,
      } as any).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
    },
    onError: (e: any) => toast.error("Failed: " + e.message),
  });

  const updateReceiptSettings = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const { error } = await supabase.from("app_settings").update({
        receipt_company_name: receiptCompanyName,
        receipt_header_text: receiptHeaderText,
        receipt_footer_text: receiptFooterText,
        receipt_contact_info: receiptContactInfo,
        receipt_prefix: receiptPrefix,
      } as any).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Receipt format saved");
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      queryClient.invalidateQueries({ queryKey: ["receiptSettings"] });
    },
    onError: (e: any) => toast.error("Failed: " + e.message),
  });

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">Facility Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="facilityName">Facility Name</Label>
            <Input id="facilityName" value={facilityName} onChange={e => setFacilityName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="maxStay">Max Stay Warning (days)</Label>
            <Input id="maxStay" type="number" min={1} value={maxStay} onChange={e => setMaxStay(parseInt(e.target.value) || 7)} />
          </div>
          <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Receipt Format
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="rcptCompany">Company Name (Header)</Label>
            <Input id="rcptCompany" value={receiptCompanyName} onChange={e => setReceiptCompanyName(e.target.value)} placeholder="AIIPL TRUCK PARKING TERMINAL" />
          </div>
          <div>
            <Label htmlFor="rcptHeader">Token/Receipt Header</Label>
            <Input id="rcptHeader" value={receiptHeaderText} onChange={e => setReceiptHeaderText(e.target.value)} placeholder="PARKING TOKEN" />
          </div>
          <div>
            <Label htmlFor="rcptPrefix">Receipt Number Prefix</Label>
            <Input id="rcptPrefix" value={receiptPrefix} onChange={e => setReceiptPrefix(e.target.value)} placeholder="AIIPL" />
            <p className="text-xs text-muted-foreground mt-1">Format: {receiptPrefix}-{new Date().getFullYear()}-XXXX</p>
          </div>
          <div>
            <Label htmlFor="rcptContact">Contact Info (optional)</Label>
            <Input id="rcptContact" value={receiptContactInfo} onChange={e => setReceiptContactInfo(e.target.value)} placeholder="Phone: +91 XXXXX XXXXX" />
          </div>
          <div>
            <Label htmlFor="rcptFooter">Footer Message</Label>
            <Textarea id="rcptFooter" value={receiptFooterText} onChange={e => setReceiptFooterText(e.target.value)} placeholder="Thank you for using our facility!" rows={2} />
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground mb-2">PREVIEW</p>
            <div className="font-mono text-xs text-center space-y-0.5">
              <p className="font-bold">{receiptCompanyName}</p>
              {receiptContactInfo && <p className="text-muted-foreground">{receiptContactInfo}</p>}
              <div className="border-t border-dashed my-1" />
              <p className="font-bold text-sm">{receiptHeaderText}</p>
              <div className="border-t border-dashed my-1" />
              <p className="text-muted-foreground">... receipt content ...</p>
              <div className="border-t border-dashed my-1" />
              <p>{receiptFooterText}</p>
            </div>
          </div>

          <Button onClick={() => updateReceiptSettings.mutate()} disabled={updateReceiptSettings.isPending}>
            {updateReceiptSettings.isPending ? "Saving..." : "Save Receipt Format"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Admin Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div>
            <Label htmlFor="newPass">New Password</Label>
            <Input id="newPass" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <Label htmlFor="confirmPass">Confirm Password</Label>
            <Input id="confirmPass" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={changePassword} variant="outline">Change Password</Button>
        </CardContent>
      </Card>
    </div>
  );
}
