import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/utils/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from "date-fns";

const COLORS = ["hsl(217,91%,60%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)", "hsl(280,60%,50%)", "hsl(180,60%,40%)"];

export default function Reports() {
  const { data: allHistory = [] } = useQuery({
    queryKey: ["allHistory"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicle_history").select("*");
      return data ?? [];
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["allPayments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*");
      return data ?? [];
    },
  });

  const totalVehicles = allHistory.length;
  const totalRevenue = allPayments.reduce((s, p) => s + p.amount, 0);
  const avgStayHours = totalVehicles > 0 ? allHistory.reduce((s, h) => s + (Number(h.total_hours) || 0), 0) / totalVehicles : 0;
  const avgStayDays = (avgStayHours / 24).toFixed(1);

  // Category breakdown
  const categoryMap = new Map<string, number>();
  allHistory.forEach(h => {
    categoryMap.set(h.pricing_category, (categoryMap.get(h.pricing_category) || 0) + h.gross_amount);
  });
  const categoryData = Array.from(categoryMap, ([name, value]) => ({ name, value }));

  // Most common category
  const categoryCount = new Map<string, number>();
  allHistory.forEach(h => categoryCount.set(h.pricing_category, (categoryCount.get(h.pricing_category) || 0) + 1));
  const topCategory = [...categoryCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  // Daily revenue (last 30 days)
  const dailyData = [];
  for (let i = 29; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const dayPayments = allPayments.filter(p => {
      const d = new Date(p.paid_at!);
      return d >= dayStart && d <= dayEnd;
    });
    dailyData.push({
      date: format(day, "dd/MM"),
      vehicles: allHistory.filter(h => {
        const d = new Date(h.exit_time);
        return d >= dayStart && d <= dayEnd;
      }).length,
      revenue: dayPayments.reduce((s, p) => s + p.amount, 0),
    });
  }

  // Monthly summary (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const month = subMonths(new Date(), i);
    const mStart = startOfMonth(month);
    const mEnd = endOfMonth(month);
    const mPayments = allPayments.filter(p => {
      const d = new Date(p.paid_at!);
      return d >= mStart && d <= mEnd;
    });
    monthlyData.push({
      month: format(month, "MMM yyyy"),
      vehicles: allHistory.filter(h => {
        const d = new Date(h.exit_time);
        return d >= mStart && d <= mEnd;
      }).length,
      revenue: mPayments.reduce((s, p) => s + p.amount, 0),
    });
  }

  const stats = [
    { label: "Total Vehicles", value: totalVehicles.toString() },
    { label: "Total Revenue", value: formatINR(totalRevenue) },
    { label: "Avg Stay", value: `${avgStayDays} days` },
    { label: "Top Category", value: topCategory },
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue by Category</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="revenue" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Daily Revenue (Last 30 Days)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Vehicles</th>
                  <th className="pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.filter(d => d.revenue > 0 || d.vehicles > 0).map(d => (
                  <tr key={d.date} className="border-b last:border-0">
                    <td className="py-2 pr-3">{d.date}</td>
                    <td className="py-2 pr-3">{d.vehicles}</td>
                    <td className="py-2 font-medium">{formatINR(d.revenue)}</td>
                  </tr>
                ))}
                {dailyData.every(d => d.revenue === 0 && d.vehicles === 0) && (
                  <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No data for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
