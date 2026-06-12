import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Printer, RotateCw, AlertTriangle, CalendarClock, Pencil } from "lucide-react";
import { formatINR, formatDate } from "@/utils/pricing";
import { getPassStatus, daysUntilExpiry } from "@/utils/monthlyPass";
import MonthlyPassFormModal from "@/components/MonthlyPassFormModal";
import MonthlyPassPrintModal from "@/components/MonthlyPassPrintModal";
import MonthlyPassEditModal from "@/components/MonthlyPassEditModal";
import Seo from "@/components/Seo";

export default function MonthlyPasses() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [formMode, setFormMode] = useState<{ mode: "create" | "renew"; pass?: any } | null>(null);
  const [printPass, setPrintPass] = useState<any>(null);
  const [editPass, setEditPass] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: passes = [], isLoading } = useQuery({
    queryKey: ["monthlyPasses"],
    queryFn: async () => {
      const { data } = await supabase.from("monthly_passes").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const filtered = passes.filter((p: any) => {
    const matches = !search ||
      p.vehicle_number.toLowerCase().includes(search.toLowerCase()) ||
      p.owner_mobile.includes(search);
    if (!matches) return false;
    const status = getPassStatus(p.pass_expiry_date);
    if (filter === "active") return status === "Active";
    if (filter === "expired") return status === "Expired";
    if (filter === "due") return p.payment_status === "Due";
    if (filter === "expiring") return status === "Active" && daysUntilExpiry(p.pass_expiry_date) <= 2;
    return true;
  });

  const stats = {
    active: passes.filter((p: any) => getPassStatus(p.pass_expiry_date) === "Active").length,
    expired: passes.filter((p: any) => getPassStatus(p.pass_expiry_date) === "Expired").length,
    due: passes.filter((p: any) => p.payment_status === "Due").length,
    expiring: passes.filter((p: any) => getPassStatus(p.pass_expiry_date) === "Active" && daysUntilExpiry(p.pass_expiry_date) <= 2).length,
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["monthlyPasses"] });

  return (
    <div className="pb-20 md:pb-0">
      <Seo title="Monthly Passes" description="Create, renew and manage monthly parking passes for heavy vehicles at the AIIPL Truck Parking Terminal — track active, expiring and expired passes." />
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Monthly Pass Vehicles</h1>
        <Button onClick={() => setFormMode({ mode: "create" })}>
          <Plus className="w-4 h-4 mr-2" /> Create Monthly Pass
        </Button>
      </div>

      {/* Alerts */}
      {(stats.expiring > 0 || stats.due > 0) && (
        <div className="mb-4 space-y-2">
          {stats.expiring > 0 && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2 text-sm">
              <CalendarClock className="w-4 h-4 text-warning" />
              <span><strong>{stats.expiring}</strong> pass{stats.expiring > 1 ? "es" : ""} expiring within 2 days</span>
            </div>
          )}
          {stats.due > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span><strong>{stats.due}</strong> pass{stats.due > 1 ? "es" : ""} with payment pending</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle or mobile..." className="pl-10" />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({passes.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
            <TabsTrigger value="expiring">Expiring ({stats.expiring})</TabsTrigger>
            <TabsTrigger value="expired">Expired ({stats.expired})</TabsTrigger>
            <TabsTrigger value="due">Due ({stats.due})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No passes found</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p: any) => {
            const status = getPassStatus(p.pass_expiry_date);
            const isPaid = p.payment_status === "Paid";
            const days = daysUntilExpiry(p.pass_expiry_date);
            const expiringSoon = status === "Active" && days <= 2;
            const colorClass =
              status === "Expired" ? "border-l-destructive" :
              !isPaid ? "border-l-warning" :
              expiringSoon ? "border-l-warning" :
              "border-l-success";

            return (
              <Card key={p.id} className={`border-l-4 ${colorClass}`}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold font-mono text-lg">{p.vehicle_number}</span>
                      <Badge variant={status === "Active" ? "default" : "destructive"}>{status}</Badge>
                      <Badge variant={isPaid ? "secondary" : "destructive"}>{p.payment_status}</Badge>
                      {expiringSoon && <Badge variant="outline" className="border-warning text-warning">Expires in {days}d</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.owner_name ? `${p.owner_name} • ` : ""}{p.owner_mobile} • {p.pricing_category}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(p.pass_start_date)} → {formatDate(p.pass_expiry_date)} • {formatINR(p.amount)} • {p.pass_id}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPrintPass(p)}>
                      <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditPass(p)}>
                      <Pencil className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button size="sm" onClick={() => setFormMode({ mode: "renew", pass: p })}>
                      <RotateCw className="w-4 h-4 mr-1" /> Renew
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {formMode && (
        <MonthlyPassFormModal
          mode={formMode.mode}
          pass={formMode.pass}
          onClose={() => setFormMode(null)}
          onSuccess={(p) => { setFormMode(null); refresh(); setPrintPass(p); }}
        />
      )}
      {printPass && <MonthlyPassPrintModal pass={printPass} onClose={() => setPrintPass(null)} />}
    </div>
  );
}
