import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Truck, AlertTriangle, Clock, Car } from "lucide-react";
import { format } from "date-fns";
import { useInterval } from "@/hooks/useInterval";
import { useNavigate } from "react-router-dom";
import Seo from "@/components/Seo";

const CATEGORIES = [
  { key: "4-Wheeler", label: "4-Wheeler", desc: "Tempos", color: "text-sky-500", bg: "bg-sky-500/10", match: (w: number) => w === 4 },
  { key: "6-Wheeler", label: "6-Wheeler", desc: "Small trucks, Mini lorries", color: "text-emerald-500", bg: "bg-emerald-500/10", match: (w: number) => w === 6 },
  { key: "7–10 Wheeler", label: "7–10 Wheeler", desc: "Medium trucks, Tankers", color: "text-amber-500", bg: "bg-amber-500/10", match: (w: number) => w >= 7 && w <= 10 },
  { key: "11–14 Wheeler", label: "11–14 Wheeler", desc: "Large trucks, Multi-axle", color: "text-orange-500", bg: "bg-orange-500/10", match: (w: number) => w >= 11 && w <= 14 },
  { key: "15–20 Wheeler", label: "15–20 Wheeler", desc: "Heavy haulage, Long trailers", color: "text-rose-500", bg: "bg-rose-500/10", match: (w: number) => w >= 15 && w <= 20 },
  { key: "20+ Wheeler", label: "20+ Wheeler", desc: "Super heavy, Special carriers", color: "text-purple-500", bg: "bg-purple-500/10", match: (w: number) => w > 20 },
];

export default function VehicleStock() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [, setTick] = useState(0);
  const navigate = useNavigate();

  useInterval(() => setTick(t => t + 1), 30000);

  const { data: restHours = 4 } = useQuery({
    queryKey: ["tempExitRestHours"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("temp_exit_rest_hours").limit(1).single();
      return (data?.temp_exit_rest_hours as number) ?? 4;
    },
  });

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["activeVehicles"],
    queryFn: async () => {
      const { data } = await supabase.from("active_vehicles").select("*").order("entry_time", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const parked = vehicles.filter(v => !v.is_temporarily_out);
  const tempOut = vehicles.filter(v => v.is_temporarily_out);

  const counts = useMemo(() => {
    return CATEGORIES.map(c => ({ ...c, count: parked.filter(v => c.match(v.num_wheels)).length }));
  }, [parked]);

  const applyFilters = (list: any[]) =>
    list.filter(v => {
      const s = search.trim().toLowerCase();
      const matchS = !s || v.vehicle_number.toLowerCase().includes(s);
      const matchC = catFilter === "All" || v.pricing_category === catFilter;
      return matchS && matchC;
    });

  const filteredParked = applyFilters(parked);
  const filteredTempOut = applyFilters(tempOut);

  const restMs = restHours * 60 * 60 * 1000;
  const now = new Date();

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <Seo title="Vehicle Stock & Inventory" description="Live count of all heavy vehicles parked at AIIPL Truck Parking Terminal, categorized by wheel count, with parked and temporarily-exited vehicle tabs." />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Vehicle Stock & Inventory</h1>
        <div className="flex items-center gap-2">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground leading-tight">Total Parked</p>
                <p className="text-xl font-bold leading-tight">{parked.length}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Stock summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {counts.map(c => (
          <Card key={c.key} className={`border-l-4 ${c.bg}`} style={{ borderLeftColor: "currentColor" }}>
            <CardContent className={`pt-4 ${c.color}`}>
              <div className="flex items-start justify-between">
                <Car className={`w-5 h-5 ${c.color}`} />
                <span className={`text-2xl font-bold ${c.color}`}>{c.count}</span>
              </div>
              <p className="text-sm font-semibold text-foreground mt-2">{c.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by vehicle number..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="parked">
        <TabsList>
          <TabsTrigger value="parked">Parked Vehicles ({filteredParked.length})</TabsTrigger>
          <TabsTrigger value="temp">Temporary Exits ({filteredTempOut.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="parked" className="mt-4">
          {isLoading ? (
            <p className="text-center py-12 text-muted-foreground">Loading...</p>
          ) : filteredParked.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No parked vehicles.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle Number</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Wheels</TableHead>
                    <TableHead>Entry Date</TableHead>
                    <TableHead>Entry Time</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParked.map(v => {
                    const isDue = v.payment_status === "Due";
                    return (
                      <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/active-vehicles")}>
                        <TableCell className="font-mono font-bold">{v.vehicle_number}</TableCell>
                        <TableCell><Badge variant="secondary">{v.pricing_category}</Badge></TableCell>
                        <TableCell className="text-center">{v.num_wheels}</TableCell>
                        <TableCell>{format(new Date(v.entry_time), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{format(new Date(v.entry_time), "hh:mm a")}</TableCell>
                        <TableCell>
                          {isDue ? (
                            <Badge variant="destructive">Due</Badge>
                          ) : (
                            <Badge className="bg-success text-success-foreground">{v.payment_mode}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="temp" className="mt-4">
          {filteredTempOut.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No vehicles on temporary exit.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle Number</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Wheels</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Temp Exit</TableHead>
                    <TableHead>Return By</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTempOut.map(v => {
                    const exitAt = v.temp_exit_time ? new Date(v.temp_exit_time) : null;
                    const returnBy = exitAt ? new Date(exitAt.getTime() + restMs) : null;
                    const overstayed = exitAt ? now.getTime() - exitAt.getTime() > restMs : false;
                    const isDue = v.payment_status === "Due";
                    return (
                      <TableRow
                        key={v.id}
                        className={`cursor-pointer hover:bg-muted/50 ${overstayed ? "bg-destructive/10" : ""}`}
                        onClick={() => navigate("/active-vehicles")}
                      >
                        <TableCell className="font-mono font-bold">
                          <div className="flex items-center gap-2">
                            {overstayed && <AlertTriangle className="w-4 h-4 text-destructive" />}
                            {v.vehicle_number}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{v.pricing_category}</Badge></TableCell>
                        <TableCell className="text-center">{v.num_wheels}</TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(v.entry_time), "dd/MM/yyyy")}<br />
                          {format(new Date(v.entry_time), "hh:mm a")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {exitAt && (<>{format(exitAt, "dd/MM/yyyy")}<br />{format(exitAt, "hh:mm a")}</>)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {returnBy && (<>{format(returnBy, "dd/MM/yyyy")}<br />{format(returnBy, "hh:mm a")}</>)}
                        </TableCell>
                        <TableCell>
                          {isDue ? (
                            <Badge variant="destructive">Due</Badge>
                          ) : (
                            <Badge className="bg-success text-success-foreground">{v.payment_mode}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {overstayed ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Overstayed</Badge>
                          ) : (
                            <Badge className="bg-success text-success-foreground gap-1"><Clock className="w-3 h-3" /> On Break</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
