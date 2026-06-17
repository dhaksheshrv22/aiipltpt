import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOverstay, formatINR, formatDateTime, formatDuration, calculateBill } from "@/utils/pricing";
import { useInterval } from "@/hooks/useInterval";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Truck, Clock, Pencil, ScanBarcode, ReceiptText, Flag, Trash2, Printer, IndianRupee, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ExitModal from "@/components/ExitModal";
import EditVehicleModal from "@/components/EditVehicleModal";
import BarcodeScanner from "@/components/BarcodeScanner";

import LedgerModal from "@/components/LedgerModal";
import ActiveVehiclePrintModal from "@/components/ActiveVehiclePrintModal";
import { useUpiSettings } from "@/hooks/useUpiSettings";
import { toast } from "sonner";
import Seo from "@/components/Seo";

export default function ActiveVehicles() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [exitVehicle, setExitVehicle] = useState<any>(null);
  const [editVehicle, setEditVehicle] = useState<any>(null);

  const [ledgerVehicle, setLedgerVehicle] = useState<any>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [deleteVehicle, setDeleteVehicle] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [printVehicle, setPrintVehicle] = useState<any>(null);

  const [quickPayId, setQuickPayId] = useState<string | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState("");
  const [quickPayMode, setQuickPayMode] = useState("");
  const [quickPaySaving, setQuickPaySaving] = useState(false);

  const [, setTick] = useState(0);
  const queryClient = useQueryClient();
  const { creditLimit } = useUpiSettings();

  useInterval(() => setTick(t => t + 1), 30000);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["activeVehicles"],
    queryFn: async () => {
      const { data } = await supabase.from("active_vehicles").select("*").order("entry_time", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const { data: paidByVehicle = {} } = useQuery({
    queryKey: ["paidByActiveVehicle"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("vehicle_id, amount")
        .not("vehicle_id", "is", null);
      const map: Record<string, number> = {};
      (data ?? []).forEach((p: any) => {
        map[p.vehicle_id] = (map[p.vehicle_id] ?? 0) + (p.amount ?? 0);
      });
      return map;
    },
    refetchInterval: 30000,
  });

  const handleScan = useCallback((code: string) => {
    setScannerOpen(false);
    toast.info(`Scanned: ${code}`);
    setSearch(code);
  }, []);

  const filtered = vehicles.filter(v => {
    const matchesSearch = !search ||
      v.vehicle_number.toLowerCase().includes(search.toLowerCase()) ||
      v.driver_mobile.includes(search);
    if (!matchesSearch) return false;
    if (filter === "overstay") return isOverstay(v.entry_time);
    if (filter === "advance") return v.advance_paid;
    if (filter === "due") return v.payment_status === "Due";
    return true;
  });

  const now = new Date();

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <Seo title="Active Vehicles" description="View all heavy vehicles currently parked, with overstay alerts and exit processing for the AIIPL Truck Parking Terminal." />
      <h1 className="text-2xl font-bold">Active Vehicles</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by vehicle or mobile..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)} title="Scan Barcode" aria-label="Scan vehicle barcode">
            <ScanBarcode className="w-5 h-5" />
          </Button>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="all">All ({vehicles.length})</TabsTrigger>
              <TabsTrigger value="overstay">Overstay</TabsTrigger>
              <TabsTrigger value="advance">Advance</TabsTrigger>
              <TabsTrigger value="due">Due</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No active vehicles found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => {
            const overstay = isOverstay(v.entry_time);
            const bill = calculateBill(new Date(v.entry_time), now, v.daily_rate, v.advance_paid ?? false);
            const paid = (paidByVehicle as Record<string, number>)[v.id] ?? 0;
            const outstanding = v.payment_status === "Paid" ? 0 : Math.max(0, bill.grossAmount - paid);
            const overLimit = creditLimit > 0 && outstanding > creditLimit;
            const borderColor = overLimit
              ? "border-l-destructive bg-destructive/5"
              : overstay
              ? "border-l-destructive bg-destructive/5"
              : v.advance_paid
              ? "border-l-success"
              : v.payment_status === "Due"
              ? "border-l-warning"
              : "border-l-primary";

            return (
              <Card key={v.id} className={`border-l-4 ${borderColor} relative`}>
                <CardContent className="pt-5 space-y-3">
                  <div className="absolute top-3 right-3 flex gap-1">
                    {overLimit && (
                      <Badge variant="destructive" className="animate-pulse"><Flag className="w-3 h-3 mr-1" />OVER LIMIT</Badge>
                    )}
                    {overstay && (
                      <Badge variant="destructive" className="animate-pulse">OVERSTAY</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-mono-vehicle text-2xl font-extrabold tracking-wider text-foreground">{v.vehicle_number}</span>
                    <Badge variant="secondary">{v.pricing_category}</Badge>
                  </div>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>📱 {v.driver_mobile}</p>
                    <p>🛞 {v.num_wheels} wheels — {formatINR(v.daily_rate)}/day</p>
                    <p>📅 {formatDateTime(v.entry_time)}</p>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium text-foreground">{formatDuration(new Date(v.entry_time), now)}</span>
                    </div>
                    <p className="font-semibold text-foreground">Est. Bill: {formatINR(bill.grossAmount)}</p>
                    {paid > 0 && (
                      <p className="text-success">Paid so far: {formatINR(paid)}</p>
                    )}
                    {outstanding > 0 && (
                      <p className="text-destructive font-semibold">Outstanding: {formatINR(outstanding)}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {v.advance_paid && <Badge className="bg-success text-success-foreground">Advance Paid</Badge>}
                    <Badge variant={v.payment_status === "Paid" ? "default" : "destructive"}>
                      {v.payment_status}
                    </Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setLedgerVehicle(v)}>
                      <ReceiptText className="w-3 h-3 mr-1" /> Ledger
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPrintVehicle(v)} title="Print parking token">
                      <Printer className="w-3 h-3 mr-1" /> Print
                    </Button>
                    <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setDeleteVehicle(v)} title="Delete entry (wrong data)">
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditVehicle(v)}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" className="flex-1" onClick={() => setExitVehicle(v)}>Exit</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {exitVehicle && (
        <ExitModal
          vehicle={exitVehicle}
          onClose={() => { setExitVehicle(null); setSearch(""); }}
          onComplete={() => {
            setExitVehicle(null);
            setSearch("");
            queryClient.invalidateQueries({ queryKey: ["activeVehicles"] });
            queryClient.invalidateQueries({ queryKey: ["activeVehicleCount"] });
          }}
        />
      )}

      {editVehicle && (
        <EditVehicleModal
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSaved={() => {
            setEditVehicle(null);
            queryClient.invalidateQueries({ queryKey: ["activeVehicles"] });
          }}
        />
      )}

      {ledgerVehicle && (
        <LedgerModal
          vehicle={ledgerVehicle}
          onClose={() => setLedgerVehicle(null)}
        />
      )}

      {printVehicle && (
        <ActiveVehiclePrintModal
          vehicle={printVehicle}
          onClose={() => setPrintVehicle(null)}
        />
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />


      <AlertDialog open={!!deleteVehicle} onOpenChange={(o) => !o && setDeleteVehicle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this vehicle entry to Recycle Bin?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono font-bold">{deleteVehicle?.vehicle_number}</span> will be removed
              from Active Vehicles and moved to the Recycle Bin, where you can restore it later or delete
              it forever. This is not a check-out and will not appear in reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteVehicle) return;
                setDeleting(true);
                try {
                  const { data: pays } = await supabase
                    .from("payments")
                    .select("*")
                    .eq("vehicle_id", deleteVehicle.id);
                  await supabase.from("deleted_vehicles" as any).insert({
                    original_id: deleteVehicle.id,
                    vehicle_number: deleteVehicle.vehicle_number,
                    driver_mobile: deleteVehicle.driver_mobile,
                    entry_time: deleteVehicle.entry_time,
                    vehicle_data: deleteVehicle,
                    payments_data: pays ?? [],
                  });
                  await supabase.from("payments").delete().eq("vehicle_id", deleteVehicle.id);
                  const { error } = await supabase.from("active_vehicles").delete().eq("id", deleteVehicle.id);
                  if (error) throw error;
                  toast.success(`${deleteVehicle.vehicle_number} moved to Recycle Bin`);
                  setDeleteVehicle(null);
                  queryClient.invalidateQueries({ queryKey: ["activeVehicles"] });
                  queryClient.invalidateQueries({ queryKey: ["activeVehicleCount"] });
                  queryClient.invalidateQueries({ queryKey: ["paidByActiveVehicle"] });
                  queryClient.invalidateQueries({ queryKey: ["recycleBin"] });
                } catch (e: any) {
                  toast.error("Delete failed: " + e.message);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
