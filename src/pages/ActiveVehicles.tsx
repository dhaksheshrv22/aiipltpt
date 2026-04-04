import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOverstay, formatINR, formatDateTime, formatDuration, calculateBill } from "@/utils/pricing";
import { useInterval } from "@/hooks/useInterval";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Truck, Clock } from "lucide-react";
import ExitModal from "@/components/ExitModal";

export default function ActiveVehicles() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [exitVehicle, setExitVehicle] = useState<any>(null);
  const [, setTick] = useState(0);
  const queryClient = useQueryClient();

  useInterval(() => setTick(t => t + 1), 60000);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["activeVehicles"],
    queryFn: async () => {
      const { data } = await supabase.from("active_vehicles").select("*").order("entry_time", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 120000,
  });

  const filtered = vehicles.filter(v => {
    const matchesSearch = !search || v.vehicle_number.toLowerCase().includes(search.toLowerCase()) || v.driver_mobile.includes(search);
    if (!matchesSearch) return false;
    if (filter === "overstay") return isOverstay(v.entry_time);
    if (filter === "advance") return v.advance_paid;
    if (filter === "due") return v.payment_status === "Due";
    return true;
  });

  const now = new Date();

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Active Vehicles</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by vehicle or mobile..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({vehicles.length})</TabsTrigger>
            <TabsTrigger value="overstay">Overstay</TabsTrigger>
            <TabsTrigger value="advance">Advance</TabsTrigger>
            <TabsTrigger value="due">Due</TabsTrigger>
          </TabsList>
        </Tabs>
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
            const borderColor = overstay ? "border-l-destructive bg-destructive/5" : v.advance_paid ? "border-l-success" : v.payment_status === "Due" ? "border-l-warning" : "border-l-primary";

            return (
              <Card key={v.id} className={`border-l-4 ${borderColor} relative`}>
                <CardContent className="pt-5 space-y-3">
                  {overstay && (
                    <Badge variant="destructive" className="absolute top-3 right-3 animate-pulse">OVERSTAY</Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-bold">{v.vehicle_number}</span>
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
                  </div>
                  <div className="flex gap-2">
                    {v.advance_paid && <Badge className="bg-success text-success-foreground">Advance Paid</Badge>}
                    <Badge variant={v.payment_status === "Paid" ? "default" : "destructive"}>
                      {v.payment_status}
                    </Badge>
                  </div>
                  <Button className="w-full" onClick={() => setExitVehicle(v)}>Process Exit</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {exitVehicle && (
        <ExitModal
          vehicle={exitVehicle}
          onClose={() => setExitVehicle(null)}
          onComplete={() => {
            setExitVehicle(null);
            queryClient.invalidateQueries({ queryKey: ["activeVehicles"] });
            queryClient.invalidateQueries({ queryKey: ["activeVehicleCount"] });
          }}
        />
      )}
    </div>
  );
}
