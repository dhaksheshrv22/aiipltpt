import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDateTime, formatDuration, formatINR, calculateBill } from "@/utils/pricing";
import { AlertTriangle } from "lucide-react";

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
  
  // Check if paid time is exceeded (using billable days concept - if advance paid, 1 day is covered)
  const paidDays = vehicle.advance_paid ? 1 : 0;
  const elapsedHours = bill.totalHours;
  const paidHours = paidDays * 26; // first day = 26h grace
  const isTimeExceeded = paidDays > 0 && elapsedHours > paidHours;

  const handleTempExit = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("active_vehicles")
      .update({
        is_temporarily_out: true,
        temp_exit_time: now.toISOString(),
        return_time: null,
      })
      .eq("id", vehicle.id);

    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success(`${vehicle.vehicle_number} marked as temporarily out`);
      onComplete();
    }
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

    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success(`${vehicle.vehicle_number} has returned`);
      onComplete();
    }
    setLoading(false);
  };

  if (mode === "temp-exit") {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Temporary Exit — {vehicle.vehicle_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The vehicle will be marked as <strong>Temporarily Out</strong>. Time will continue to run. The vehicle must return before the paid time expires.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Vehicle:</span>
              <span className="font-mono font-bold">{vehicle.vehicle_number}</span>
              <span className="text-muted-foreground">Entry Time:</span>
              <span>{formatDateTime(vehicle.entry_time)}</span>
              <span className="text-muted-foreground">Parked For:</span>
              <span>{formatDuration(entryTime, now)}</span>
              <span className="text-muted-foreground">Current Bill:</span>
              <span className="font-semibold">{formatINR(bill.grossAmount)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90" onClick={handleTempExit} disabled={loading}>
                {loading ? "Processing..." : "Confirm Temp Exit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Return mode
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Vehicle — {vehicle.vehicle_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isTimeExceeded && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Paid time exceeded!</p>
                <p className="text-muted-foreground">Additional charges will apply upon full exit.</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Vehicle:</span>
            <span className="font-mono font-bold">{vehicle.vehicle_number}</span>
            <span className="text-muted-foreground">Entry Time:</span>
            <span>{formatDateTime(vehicle.entry_time)}</span>
            <span className="text-muted-foreground">Temp Exit Time:</span>
            <span>{vehicle.temp_exit_time ? formatDateTime(vehicle.temp_exit_time) : "—"}</span>
            <span className="text-muted-foreground">Time Away:</span>
            <span>{vehicle.temp_exit_time ? formatDuration(new Date(vehicle.temp_exit_time), now) : "—"}</span>
            <span className="text-muted-foreground">Total Parked:</span>
            <span className="font-medium">{formatDuration(entryTime, now)}</span>
            <span className="text-muted-foreground">Current Bill:</span>
            <span className="font-semibold">{formatINR(bill.grossAmount)}</span>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleReturn} disabled={loading}>
              {loading ? "Processing..." : "Confirm Return"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
