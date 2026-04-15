import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, IndianRupee, AlertTriangle, TrendingUp, PlusCircle, LogOut as ExitIcon, BarChart3, Clock } from "lucide-react";
import { isOverstay, formatINR, formatDateTime, formatDuration } from "@/utils/pricing";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: activeVehicles = [] } = useQuery({
    queryKey: ["activeVehicles"],
    queryFn: async () => {
      const { data } = await supabase.from("active_vehicles").select("*").order("entry_time", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 120000,
  });

  const { data: todayRevenue = 0 } = useQuery({
    queryKey: ["todayRevenue"],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const { data } = await supabase.from("payments").select("amount").gte("paid_at", today.toISOString());
      return data?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
    },
    refetchInterval: 120000,
  });

  const { data: monthRevenue = 0 } = useQuery({
    queryKey: ["monthRevenue"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date());
      const { data } = await supabase.from("payments").select("amount").gte("paid_at", monthStart.toISOString());
      return data?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
    },
    refetchInterval: 120000,
  });

  const { data: recentHistory = [] } = useQuery({
    queryKey: ["recentHistory"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicle_history").select("*").order("exit_time", { ascending: false }).limit(10);
      return data ?? [];
    },
    refetchInterval: 120000,
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ["revenueChart"],
    queryFn: async () => {
      const days = 7;
      const results = [];
      for (let i = days - 1; i >= 0; i--) {
        const day = subDays(new Date(), i);
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const { data } = await supabase.from("payments").select("amount").gte("paid_at", dayStart.toISOString()).lte("paid_at", dayEnd.toISOString());
        results.push({
          date: format(day, "dd MMM"),
          revenue: data?.reduce((s, p) => s + p.amount, 0) ?? 0,
        });
      }
      return results;
    },
    refetchInterval: 120000,
  });

  const overstayVehicles = activeVehicles.filter(v => isOverstay(v.entry_time));
  const tempOutVehicles = activeVehicles.filter(v => v.is_temporarily_out);

  const stats = [
    { label: "Active Vehicles", value: activeVehicles.length, icon: Truck, color: "text-primary" },
    { label: "Temp Out", value: tempOutVehicles.length, icon: Clock, color: "text-warning" },
    { label: "Today's Revenue", value: formatINR(todayRevenue), icon: IndianRupee, color: "text-success" },
    { label: "Overstay Alerts", value: overstayVehicles.length, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/entry")} size="sm"><PlusCircle className="w-4 h-4 mr-1" /> New Entry</Button>
          <Button onClick={() => navigate("/active-vehicles")} variant="outline" size="sm"><ExitIcon className="w-4 h-4 mr-1" /> Process Exit</Button>
        </div>
      </div>

      {overstayVehicles.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Overstay Alert!</p>
            <p className="text-sm text-muted-foreground">
              {overstayVehicles.map(v => v.vehicle_number).join(", ")} — parked over 7 days.
            </p>
          </div>
        </div>
      )}

      {tempOutVehicles.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-warning mt-0.5" />
          <div>
            <p className="font-semibold text-warning">Temporarily Out</p>
            <p className="text-sm text-muted-foreground">
              {tempOutVehicles.map(v => v.vehicle_number).join(", ")} — currently outside, time still running.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
                <s.icon className={`w-8 h-8 ${s.color} opacity-20`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="revenue" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Exits</CardTitle>
        </CardHeader>
        <CardContent>
          {recentHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No exit records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Vehicle</th>
                    <th className="pb-2 pr-4 hidden sm:table-cell">Entry</th>
                    <th className="pb-2 pr-4 hidden sm:table-cell">Exit</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentHistory.map(h => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono font-bold">{h.vehicle_number}</td>
                      <td className="py-2 pr-4 hidden sm:table-cell">{formatDateTime(h.entry_time)}</td>
                      <td className="py-2 pr-4 hidden sm:table-cell">{formatDateTime(h.exit_time)}</td>
                      <td className="py-2 pr-4">{formatINR(h.gross_amount)}</td>
                      <td className="py-2">
                        <Badge variant={h.final_payment_status === "Paid" ? "default" : "destructive"}>
                          {h.final_payment_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
