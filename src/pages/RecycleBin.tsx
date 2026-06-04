import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, Truck } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { formatDateTime } from "@/utils/pricing";

export default function RecycleBin() {
  const qc = useQueryClient();
  const [purge, setPurge] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["recycleBin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deleted_vehicles" as any)
        .select("*")
        .order("deleted_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const restore = async (item: any) => {
    setBusy(true);
    try {
      const { id: _ignore, created_at: _c, ...row } = item.vehicle_data || {};
      const { error } = await supabase.from("active_vehicles").insert({ ...row, id: item.original_id });
      if (error) throw error;
      const pays = (item.payments_data as any[]) || [];
      if (pays.length > 0) {
        const cleanPays = pays.map(({ id: _i, created_at: _c2, ...p }: any) => p);
        await supabase.from("payments").insert(cleanPays);
      }
      await supabase.from("deleted_vehicles" as any).delete().eq("id", item.id);
      toast.success(`${item.vehicle_number} restored`);
      qc.invalidateQueries({ queryKey: ["recycleBin"] });
      qc.invalidateQueries({ queryKey: ["activeVehicles"] });
      qc.invalidateQueries({ queryKey: ["activeVehicleCount"] });
    } catch (e: any) {
      toast.error("Restore failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const purgeNow = async () => {
    if (!purge) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("deleted_vehicles" as any).delete().eq("id", purge.id);
      if (error) throw error;
      toast.success(`${purge.vehicle_number} permanently removed`);
      setPurge(null);
      qc.invalidateQueries({ queryKey: ["recycleBin"] });
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <Seo title="Recycle Bin" description="Restore or permanently remove deleted vehicle entries." />
      <h1 className="text-2xl font-bold">Recycle Bin</h1>
      <p className="text-sm text-muted-foreground">
        Deleted vehicle entries are kept here. Restore them back to Active Vehicles or remove them permanently.
      </p>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Recycle bin is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item: any) => (
            <Card key={item.id} className="border-l-4 border-l-destructive/60">
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono-vehicle text-xl font-extrabold tracking-wider text-foreground">
                    {item.vehicle_number}
                  </span>
                  <Badge variant="destructive">Deleted</Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>📱 {item.driver_mobile || "—"}</p>
                  <p>📅 Entry: {item.entry_time ? formatDateTime(item.entry_time) : "—"}</p>
                  <p>🗑 Deleted: {formatDateTime(item.deleted_at)}</p>
                  <p>💳 Payments saved: {(item.payments_data as any[])?.length || 0}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" disabled={busy} onClick={() => restore(item)}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    disabled={busy}
                    onClick={() => setPurge(item)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Delete forever
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!purge} onOpenChange={(o) => !o && setPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently remove this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono font-bold">{purge?.vehicle_number}</span> will be erased from
              the recycle bin and cannot be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={purgeNow}
            >
              {busy ? "Removing..." : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
