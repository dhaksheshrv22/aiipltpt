import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [facilityName, setFacilityName] = useState("");
  const [maxStay, setMaxStay] = useState(7);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
    }
  }, [settings]);

  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const { error } = await supabase.from("app_settings").update({
        facility_name: facilityName,
        max_stay_days: maxStay,
      }).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
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
