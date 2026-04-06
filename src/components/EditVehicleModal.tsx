import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [notes, setNotes] = useState(vehicle.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!date || !time) {
      toast.error("Date and time are required");
      return;
    }

    const newEntryTime = new Date(`${date}T${time}:00`);
    if (isNaN(newEntryTime.getTime())) {
      toast.error("Invalid date/time");
      return;
    }
    if (newEntryTime > new Date()) {
      toast.error("Entry time cannot be in the future");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("active_vehicles")
      .update({
        entry_time: newEntryTime.toISOString(),
        driver_mobile: driverMobile.trim(),
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        notes: notes.trim() || null,
      })
      .eq("id", vehicle.id);

    setSaving(false);

    if (error) {
      toast.error("Failed to update: " + error.message);
      return;
    }

    toast.success("Vehicle updated successfully");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Vehicle — {vehicle.vehicle_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="vehicleNum">Vehicle Number</Label>
            <Input
              id="vehicleNum"
              value={vehicleNumber}
              onChange={e => setVehicleNumber(e.target.value)}
              className="font-mono uppercase"
            />
          </div>

          <div>
            <Label htmlFor="driverMob">Driver Mobile</Label>
            <Input
              id="driverMob"
              value={driverMobile}
              onChange={e => setDriverMobile(e.target.value)}
              inputMode="tel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="entryDate">Entry Date</Label>
              <Input
                id="entryDate"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="entryTime">Entry Time</Label>
              <Input
                id="entryTime"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
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
