import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/utils/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { format, getYear, getMonth, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { Download, FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Seo from "@/components/Seo";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COLORS = ["hsl(217,91%,60%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)", "hsl(280,60%,50%)", "hsl(180,60%,40%)"];

type Payment = { amount: number; paid_at: string | null; payment_mode: string; payment_type: string; vehicle_number: string };
type History = { exit_time: string; pricing_category: string; gross_amount: number; total_hours: number | null; vehicle_number: string };

export default function Reports() {
  const { data: payments = [] } = useQuery({
    queryKey: ["reports-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("amount, paid_at, payment_mode, payment_type, vehicle_number");
      return (data ?? []) as Payment[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["reports-history"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicle_history").select("exit_time, pricing_category, gross_amount, total_hours, vehicle_number");
      return (data ?? []) as History[];
    },
  });

  const years = useMemo(() => {
    const set = new Set<number>();
    payments.forEach(p => p.paid_at && set.add(getYear(new Date(p.paid_at))));
    history.forEach(h => set.add(getYear(new Date(h.exit_time))));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [payments, history]);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <Seo title="Reports" description="Monthly and yearly revenue, occupancy, payment-mode and category reports for the AIIPL Truck Parking Terminal — exportable to PDF and Excel." />
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Monthly and yearly performance insights</p>
      </div>

      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="monthly">Monthly Reports</TabsTrigger>
          <TabsTrigger value="yearly">Yearly Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-6">
          <MonthlyReport payments={payments} history={history} years={years} />
        </TabsContent>

        <TabsContent value="yearly" className="mt-6">
          <YearlyReport payments={payments} history={history} years={years} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <div className="text-xs mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ExportButtons({ onPdf, onXlsx, onCsv }: { onPdf: () => void; onXlsx: () => void; onCsv: () => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={onPdf}><Download className="w-4 h-4" /> PDF</Button>
      <Button variant="outline" size="sm" onClick={onXlsx}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
      <Button variant="outline" size="sm" onClick={onCsv}><Download className="w-4 h-4" /> CSV</Button>
    </div>
  );
}

function exportPdf(title: string, head: string[], rows: (string | number)[][]) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, { head: [head], body: rows.map(r => r.map(String)), startY: 22, styles: { fontSize: 9 } });
  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
}

function exportXlsx(name: string, head: string[], rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${name}.xlsx`);
}

function exportCsv(name: string, head: string[], rows: (string | number)[][]) {
  const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url);
}

function MonthlyReport({ payments, history, years }: { payments: Payment[]; history: History[]; years: number[] }) {
  const [year, setYear] = useState<number>(years[0] ?? new Date().getFullYear());

  const monthly = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(start);
    const yearPayments = payments.filter(p => {
      if (!p.paid_at) return false;
      const d = new Date(p.paid_at);
      return d >= start && d <= end;
    });
    const yearHistory = history.filter(h => {
      const d = new Date(h.exit_time);
      return d >= start && d <= end;
    });

    return MONTHS.map((label, i) => {
      const mPayments = yearPayments.filter(p => getMonth(new Date(p.paid_at!)) === i);
      const mHistory = yearHistory.filter(h => getMonth(new Date(h.exit_time)) === i);
      const revenue = mPayments.reduce((s, p) => s + p.amount, 0);
      return {
        month: label,
        vehicles: mHistory.length,
        revenue,
        avgBill: mHistory.length ? Math.round(revenue / mHistory.length) : 0,
      };
    });
  }, [payments, history, year]);

  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
  const totalVehicles = monthly.reduce((s, m) => s + m.vehicles, 0);
  const bestMonth = [...monthly].sort((a, b) => b.revenue - a.revenue)[0];
  const avgMonthly = totalRevenue / 12;

  const tableHead = ["Month", "Vehicles", "Revenue (INR)", "Avg Bill (INR)"];
  const tableRows = monthly.map(m => [m.month, m.vehicles, m.revenue, m.avgBill]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Year</label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ExportButtons
          onPdf={() => exportPdf(`Monthly Report ${year}`, tableHead, tableRows)}
          onXlsx={() => exportXlsx(`Monthly_Report_${year}`, tableHead, tableRows)}
          onCsv={() => exportCsv(`Monthly_Report_${year}`, tableHead, tableRows)}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatINR(totalRevenue)} />
        <StatCard label="Total Vehicles" value={String(totalVehicles)} />
        <StatCard label="Avg / Month" value={formatINR(Math.round(avgMonthly))} />
        <StatCard label="Best Month" value={bestMonth?.month ?? "-"} sub={<span className="text-muted-foreground">{formatINR(bestMonth?.revenue ?? 0)}</span>} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Revenue by Month — {year}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="revenue" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Detailed Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Month</th>
                  <th className="pb-2 pr-3">Vehicles</th>
                  <th className="pb-2 pr-3">Revenue</th>
                  <th className="pb-2">Avg Bill</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(m => (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{m.month}</td>
                    <td className="py-2 pr-3">{m.vehicles}</td>
                    <td className="py-2 pr-3">{formatINR(m.revenue)}</td>
                    <td className="py-2">{formatINR(m.avgBill)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function YearlyReport({ payments, history, years }: { payments: Payment[]; history: History[]; years: number[] }) {
  const yearly = useMemo(() => {
    return [...years].sort((a, b) => a - b).map(y => {
      const start = startOfYear(new Date(y, 0, 1));
      const end = endOfYear(start);
      const yPayments = payments.filter(p => p.paid_at && new Date(p.paid_at) >= start && new Date(p.paid_at) <= end);
      const yHistory = history.filter(h => new Date(h.exit_time) >= start && new Date(h.exit_time) <= end);
      const revenue = yPayments.reduce((s, p) => s + p.amount, 0);
      return {
        year: String(y),
        vehicles: yHistory.length,
        revenue,
        avgBill: yHistory.length ? Math.round(revenue / yHistory.length) : 0,
      };
    });
  }, [payments, history, years]);

  // Category breakdown across all years
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    history.forEach(h => map.set(h.pricing_category, (map.get(h.pricing_category) || 0) + h.gross_amount));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [history]);

  const totalRevenue = yearly.reduce((s, y) => s + y.revenue, 0);
  const totalVehicles = yearly.reduce((s, y) => s + y.vehicles, 0);
  const current = yearly[yearly.length - 1];
  const previous = yearly[yearly.length - 2];
  const growth = previous && previous.revenue > 0
    ? ((current.revenue - previous.revenue) / previous.revenue) * 100
    : null;

  const tableHead = ["Year", "Vehicles", "Revenue (INR)", "Avg Bill (INR)"];
  const tableRows = yearly.map(y => [y.year, y.vehicles, y.revenue, y.avgBill]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButtons
          onPdf={() => exportPdf("Yearly Report", tableHead, tableRows)}
          onXlsx={() => exportXlsx("Yearly_Report", tableHead, tableRows)}
          onCsv={() => exportCsv("Yearly_Report", tableHead, tableRows)}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lifetime Revenue" value={formatINR(totalRevenue)} />
        <StatCard label="Lifetime Vehicles" value={String(totalVehicles)} />
        <StatCard label={`${current?.year ?? "-"} Revenue`} value={formatINR(current?.revenue ?? 0)} />
        <StatCard
          label="YoY Growth"
          value={growth === null ? "—" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}
          sub={growth === null ? null : (
            <span className={`flex items-center gap-1 ${growth >= 0 ? "text-green-600" : "text-red-600"}`}>
              {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              vs {previous?.year}
            </span>
          )}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Yearly Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yearly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="hsl(217,91%,60%)" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue by Category</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Year-over-Year Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Year</th>
                  <th className="pb-2 pr-3">Vehicles</th>
                  <th className="pb-2 pr-3">Revenue</th>
                  <th className="pb-2 pr-3">Avg Bill</th>
                  <th className="pb-2">Growth</th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((y, i) => {
                  const prev = yearly[i - 1];
                  const g = prev && prev.revenue > 0 ? ((y.revenue - prev.revenue) / prev.revenue) * 100 : null;
                  return (
                    <tr key={y.year} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{y.year}</td>
                      <td className="py-2 pr-3">{y.vehicles}</td>
                      <td className="py-2 pr-3">{formatINR(y.revenue)}</td>
                      <td className="py-2 pr-3">{formatINR(y.avgBill)}</td>
                      <td className={`py-2 ${g === null ? "" : g >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {g === null ? "—" : `${g >= 0 ? "+" : ""}${g.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
