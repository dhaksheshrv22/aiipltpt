import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentShift } from "@/hooks/useCurrentShift";
import { ClockIcon, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ShiftHandoverDialog from "./ShiftHandoverDialog";

export default function ShiftControl() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: current } = useCurrentShift();
  const [startOpen, setStartOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [operatorName, setOperatorName] = useState(user?.email?.split("@")[0] ?? "");
  const [starting, setStarting] = useState(false);

  const startShift = async () => {
    if (!operatorName.trim()) {
      toast.error("Enter operator name");
      return;
    }
    setStarting(true);
    const { error } = await supabase.from("shifts").insert({
      operator_name: operatorName.trim(),
      start_at: new Date().toISOString(),
      status: "open",
    });
    setStarting(false);
    if (error) {
      toast.error("Failed: " + error.message);
      return;
    }
    toast.success(`Shift started for ${operatorName}`);
    setStartOpen(false);
    qc.invalidateQueries({ queryKey: ["currentShift"] });
    qc.invalidateQueries({ queryKey: ["shiftsList"] });
  };

  if (current) {
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setHandoverOpen(true)} className="gap-1.5 hidden sm:flex">
          <ClockIcon className="w-3.5 h-3.5 text-success" />
          <span className="font-mono text-xs">{current.operator_name}</span>
          <span className="text-muted-foreground text-xs">· {format(new Date(current.start_at), "HH:mm")}</span>
          <Square className="w-3.5 h-3.5 ml-1" />
        </Button>
        <Button size="icon" variant="outline" onClick={() => setHandoverOpen(true)} className="sm:hidden">
          <Square className="w-4 h-4" />
        </Button>
        {handoverOpen && (
          <ShiftHandoverDialog
            shift={current}
            onClose={() => setHandoverOpen(false)}
            onClosed={() => setHandoverOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setStartOpen(true)} className="gap-1.5">
        <Play className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Start Shift</span>
      </Button>
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Start New Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Operator Name</Label>
              <Input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="e.g. Ramesh" autoFocus />
            </div>
            <Button onClick={startShift} disabled={starting} className="w-full">
              {starting ? "Starting…" : "Start Shift"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
