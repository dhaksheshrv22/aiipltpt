import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, calculateBill } from "@/utils/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { format, getYear, getMonth, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, eachDayOfInterval, subDays, isWithinInterval, parseISO } from "date-fns";
import { Download, FileSpreadsheet, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import Seo from "@/components/Seo";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COLORS = ["hsl(217,91%,60%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)", "hsl(280,60%,50%)", "hsl(180,60%,40%)"];

type Payment = { amount: number; paid_at: string | null; payment_mode: string; payment_type: string; vehicle_number: string };
type History = { entry_time: string; exit_time: string; pricing_category: string; gross_amount: number; total_hours: number | null; vehicle_number: string };
type ActiveVeh = { vehicle_number: string; pricing_category: string; entry_time: string; is_temporarily_out: boolean; temp_exit_time: string | null; return_time: string | null };

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
      const { data } = await supabase.from("vehicle_history").select("entry_time, exit_time, pricing_category, gross_amount, total_hours, vehicle_number");
      return (data ?? []) as History[];
    },
  });

  const { data: active = [] } = useQuery({
    queryKey: ["reports-active"],
    queryFn: async () => {
      const { data } = await supabase.from("active_vehicles").select("vehicle_number, pricing_category, entry_time, is_temporarily_out, temp_exit_time, return_time");
      return (data ?? []) as any[];
    },
    refetchInterval: 60_000,
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

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
          <TabsTrigger value="dues">Outstanding Dues</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-6">
          <DailyReport payments={payments} history={history} active={active as ActiveVeh[]} />
        </TabsContent>

        <TabsContent value="monthly" className="mt-6">
          <MonthlyReport payments={payments} history={history} years={years} />
        </TabsContent>

        <TabsContent value="yearly" className="mt-6">
          <YearlyReport payments={payments} history={history} years={years} />
        </TabsContent>

        <TabsContent value="dues" className="mt-6">
          <OutstandingDuesReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DailyReport({ payments, history }: { payments: Payment[]; history: History[] }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState<string>(today);
  const [rangeDays, setRangeDays] = useState<number>(7);

  const selected = useMemo(() => parseISO(date), [date]);
  const dayStart = startOfDay(selected);
  const dayEnd = endOfDay(selected);

function DailyReport({ payments, history, active }: { payments: Payment[]; history: History[]; active: ActiveVeh[] }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState<string>(today);
  const [rangeDays, setRangeDays] = useState<number>(7);

  const selected = useMemo(() => parseISO(date), [date]);
  const dayStart = startOfDay(selected);
  const dayEnd = endOfDay(selected);
  const inDay = (d: string | null | undefined) => !!d && isWithinInterval(new Date(d), { start: dayStart, end: dayEnd });

  const dayPayments = payments.filter(p => inDay(p.paid_at));
  const dayHistory = history.filter(h => inDay(h.exit_time));
  const revenue = dayPayments.reduce((s, p) => s + p.amount, 0);
  const vehicles = dayHistory.length;
  const avgBill = vehicles ? Math.round(revenue / vehicles) : 0;

  // Cash / UPI / Card totals
  const sumByMode = (mode: string) => dayPayments.filter(p => p.payment_mode === mode).reduce((s, p) => s + p.amount, 0);
  const cashTotal = sumByMode("Cash");
  const upiTotal = sumByMode("UPI");
  const cardTotal = sumByMode("Card");

  // Source breakdown (Advance / TempExit / Exit / Partial) × Mode
  const SOURCES = ["Advance", "TempExit", "Exit", "Partial"];
  const sourceMatrix = SOURCES.map(src => {
    const rows = dayPayments.filter(p => p.payment_type === src);
    return {
      source: src === "TempExit" ? "Temp Exit" : src,
      cash: rows.filter(p => p.payment_mode === "Cash").reduce((s, p) => s + p.amount, 0),
      upi: rows.filter(p => p.payment_mode === "UPI").reduce((s, p) => s + p.amount, 0),
      card: rows.filter(p => p.payment_mode === "Card").reduce((s, p) => s + p.amount, 0),
      total: rows.reduce((s, p) => s + p.amount, 0),
    };
  });

  // Entries today: from active_vehicles entry_time + history entry_time
  const entriesToday = [
    ...active.filter(v => inDay(v.entry_time)).map(v => ({ vehicle_number: v.vehicle_number, pricing_category: v.pricing_category, entry_time: v.entry_time, status: "Active" as const })),
    ...history.filter(h => inDay(h.entry_time)).map(h => ({ vehicle_number: h.vehicle_number, pricing_category: h.pricing_category, entry_time: h.entry_time, status: "Exited" as const })),
  ].sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime());

  // Temp exits today: from active table (still out or returned same day)
  const tempExitsToday = active
    .filter(v => inDay(v.temp_exit_time))
    .map(v => ({
      vehicle_number: v.vehicle_number,
      pricing_category: v.pricing_category,
      temp_exit_time: v.temp_exit_time!,
      return_time: v.return_time,
      is_out: v.is_temporarily_out,
    }))
    .sort((a, b) => new Date(b.temp_exit_time).getTime() - new Date(a.temp_exit_time).getTime());

  const modeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    dayPayments.forEach(p => map.set(p.payment_mode, (map.get(p.payment_mode) || 0) + p.amount));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [dayPayments]);

  const trend = useMemo(() => {
    const end = endOfDay(selected);
    const start = startOfDay(subDays(selected, rangeDays - 1));
    return eachDayOfInterval({ start, end }).map(d => {
      const dS = startOfDay(d), dE = endOfDay(d);
      const rev = payments.filter(p => p.paid_at && isWithinInterval(new Date(p.paid_at), { start: dS, end: dE })).reduce((s, p) => s + p.amount, 0);
      const veh = history.filter(h => isWithinInterval(new Date(h.exit_time), { start: dS, end: dE })).length;
      return { day: format(d, "dd MMM"), revenue: rev, vehicles: veh };
    });
  }, [payments, history, selected, rangeDays]);

  const txHead = ["Time", "Vehicle", "Type", "Mode", "Amount (INR)"];
  const txRows = [...dayPayments]
    .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())
    .map(p => [format(new Date(p.paid_at!), "HH:mm"), p.vehicle_number, p.payment_type, p.payment_mode, p.amount]);

  const label = format(selected, "dd MMM yyyy");

  // Combined PDF/CSV export with all sections
  const buildExportRows = () => {
    const out: (string | number)[][] = [];
    out.push(["=== COLLECTIONS BY SOURCE ==="]);
    out.push(["Source", "Cash", "UPI", "Card", "Total"]);
    sourceMatrix.forEach(r => out.push([r.source, r.cash, r.upi, r.card, r.total]));
    out.push(["TOTAL", cashTotal, upiTotal, cardTotal, revenue]);
    out.push([""]);
    out.push(["=== TRANSACTIONS ==="]);
    out.push(txHead);
    txRows.forEach(r => out.push(r));
    out.push([""]);
    out.push([`=== ENTRIES TODAY (${entriesToday.length}) ===`]);
    out.push(["Time", "Vehicle", "Category", "Status"]);
    entriesToday.forEach(e => out.push([format(new Date(e.entry_time), "HH:mm"), e.vehicle_number, e.pricing_category, e.status]));
    out.push([""]);
    out.push([`=== EXITS TODAY (${dayHistory.length}) ===`]);
    out.push(["Time", "Vehicle", "Category", "Gross (INR)"]);
    dayHistory
      .sort((a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime())
      .forEach(h => out.push([format(new Date(h.exit_time), "HH:mm"), h.vehicle_number, h.pricing_category, h.gross_amount]));
    out.push([""]);
    out.push([`=== TEMPORARY REST TODAY (${tempExitsToday.length}) ===`]);
    out.push(["Out At", "Vehicle", "Category", "Return Status"]);
    tempExitsToday.forEach(t => out.push([
      format(new Date(t.temp_exit_time), "HH:mm"),
      t.vehicle_number,
      t.pricing_category,
      t.is_out ? "Still Out" : t.return_time ? `Returned ${format(new Date(t.return_time), "HH:mm")}` : "Returned",
    ]));
    return out;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Date</label>
            <Input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className="w-44" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Trend Range</label>
            <Select value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDate(today)}>Today</Button>
        </div>
        <ExportButtons
          onPdf={() => exportPdf(`Daily Report ${label}`, ["Section / Field", "A", "B", "C", "D"], buildExportRows())}
          onXlsx={() => exportXlsx(`Daily_Report_${date}`, ["Section / Field", "A", "B", "C", "D"], buildExportRows())}
          onCsv={() => exportCsv(`Daily_Report_${date}`, ["Section / Field", "A", "B", "C", "D"], buildExportRows())}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatINR(revenue)} sub={<span className="text-muted-foreground">{label}</span>} />
        <StatCard label="Cash" value={formatINR(cashTotal)} />
        <StatCard label="UPI" value={formatINR(upiTotal)} />
        <StatCard label="Card" value={formatINR(cardTotal)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Collections by Source — {label}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3 text-right">Cash</th>
                  <th className="pb-2 pr-3 text-right">UPI</th>
                  <th className="pb-2 pr-3 text-right">Card</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sourceMatrix.map(r => (
                  <tr key={r.source} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{r.source}</td>
                    <td className="py-2 pr-3 text-right">{formatINR(r.cash)}</td>
                    <td className="py-2 pr-3 text-right">{formatINR(r.upi)}</td>
                    <td className="py-2 pr-3 text-right">{formatINR(r.card)}</td>
                    <td className="py-2 text-right font-bold">{formatINR(r.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2">
                  <td className="py-2 pr-3 font-bold">TOTAL</td>
                  <td className="py-2 pr-3 text-right font-bold">{formatINR(cashTotal)}</td>
                  <td className="py-2 pr-3 text-right font-bold">{formatINR(upiTotal)}</td>
                  <td className="py-2 pr-3 text-right font-bold">{formatINR(cardTotal)}</td>
                  <td className="py-2 text-right font-bold">{formatINR(revenue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Entries Today" value={String(entriesToday.length)} />
        <StatCard label="Exits Today" value={String(vehicles)} />
        <StatCard label="Temporary Rest" value={String(tempExitsToday.length)} />
        <StatCard label="Avg Bill" value={formatINR(avgBill)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue — Last {rangeDays} Days</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="revenue" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Payment Mode — {label}</CardTitle></CardHeader>
          <CardContent>
            {modeBreakdown.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No payments on this day.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={modeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {modeBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Entries — {label} ({entriesToday.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Vehicle</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {entriesToday.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No entries on this day.</td></tr>
                ) : entriesToday.map((e, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3">{format(new Date(e.entry_time), "HH:mm")}</td>
                    <td className="py-2 pr-3 font-mono font-semibold">{e.vehicle_number}</td>
                    <td className="py-2 pr-3">{e.pricing_category}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${e.status === "Active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {e.status === "Active" ? "Still Parked" : "Exited"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Exits — {label} ({dayHistory.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Vehicle</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 text-right">Gross</th>
                </tr>
              </thead>
              <tbody>
                {dayHistory.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No exits on this day.</td></tr>
                ) : [...dayHistory].sort((a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime()).map((h, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3">{format(new Date(h.exit_time), "HH:mm")}</td>
                    <td className="py-2 pr-3 font-mono font-semibold">{h.vehicle_number}</td>
                    <td className="py-2 pr-3">{h.pricing_category}</td>
                    <td className="py-2 text-right font-bold">{formatINR(h.gross_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Temporary Rest — {label} ({tempExitsToday.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Out At</th>
                  <th className="pb-2 pr-3">Vehicle</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2">Return</th>
                </tr>
              </thead>
              <tbody>
                {tempExitsToday.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No temporary exits on this day.</td></tr>
                ) : tempExitsToday.map((t, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3">{format(new Date(t.temp_exit_time), "HH:mm")}</td>
                    <td className="py-2 pr-3 font-mono font-semibold">{t.vehicle_number}</td>
                    <td className="py-2 pr-3">{t.pricing_category}</td>
                    <td className="py-2">
                      {t.is_out ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-warning/10 text-warning">Still Out</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-success/10 text-success">
                          Returned{t.return_time ? ` at ${format(new Date(t.return_time), "HH:mm")}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">All Transactions — {label}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Vehicle</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Mode</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txRows.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No transactions on this day.</td></tr>
                ) : txRows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3">{r[0]}</td>
                    <td className="py-2 pr-3 font-mono font-semibold">{r[1]}</td>
                    <td className="py-2 pr-3">{r[2]}</td>
                    <td className="py-2 pr-3">{r[3]}</td>
                    <td className="py-2 text-right font-bold">{formatINR(r[4] as number)}</td>
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

function OutstandingDuesReport() {
  const { data: active = [] } = useQuery({
    queryKey: ["outstandingDues"],
    queryFn: async () => {
      const { data } = await supabase.from("active_vehicles").select("*").order("entry_time", { ascending: true });
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
  const { data: paidByVehicle = {} } = useQuery({
    queryKey: ["outstandingDuesPayments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("vehicle_id, amount").not("vehicle_id", "is", null);
      const map: Record<string, number> = {};
      (data ?? []).forEach((p: any) => { map[p.vehicle_id] = (map[p.vehicle_id] ?? 0) + (p.amount ?? 0); });
      return map;
    },
    refetchInterval: 60_000,
  });

  const now = new Date();
  const rows = (active as any[])
    .filter(v => !v.is_monthly_pass)
    .map(v => {
      const bill = calculateBill(new Date(v.entry_time), now, v.daily_rate, v.advance_paid ?? false);
      const paid = (paidByVehicle as Record<string, number>)[v.id] ?? 0;
      const balance = Math.max(0, bill.grossAmount - paid);
      const days = Math.max(1, Math.ceil((now.getTime() - new Date(v.entry_time).getTime()) / (1000 * 60 * 60 * 24)));
      return { v, paid, balance, gross: bill.grossAmount, days };
    })
    .filter(r => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const grandTotal = rows.reduce((s, r) => s + r.balance, 0);
  const tableHead = ["Vehicle", "Category", "Entry", "Days", "Charged", "Paid", "Balance"];
  const tableRows = rows.map(r => [
    r.v.vehicle_number, r.v.pricing_category,
    format(new Date(r.v.entry_time), "dd MMM yyyy"),
    r.days, r.gross, r.paid, r.balance,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Card className="flex-1 min-w-[240px]">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Outstanding (active sessions)</p>
            <p className="text-3xl font-bold text-destructive">{formatINR(grandTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{rows.length} vehicle{rows.length === 1 ? "" : "s"} with balance due</p>
          </CardContent>
        </Card>
        <ExportButtons
          onPdf={() => exportPdf("Outstanding Dues", tableHead, tableRows)}
          onXlsx={() => exportXlsx("Outstanding_Dues", tableHead, tableRows)}
          onCsv={() => exportCsv("Outstanding_Dues", tableHead, tableRows)}
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Unpaid / Partial Balances</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Vehicle</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Entry</th>
                  <th className="pb-2 pr-3">Days</th>
                  <th className="pb-2 pr-3">Charged</th>
                  <th className="pb-2 pr-3">Paid</th>
                  <th className="pb-2">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No outstanding balances. 🎉</td></tr>
                ) : rows.map(r => (
                  <tr key={r.v.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono font-semibold">{r.v.vehicle_number}</td>
                    <td className="py-2 pr-3">{r.v.pricing_category}</td>
                    <td className="py-2 pr-3">{format(new Date(r.v.entry_time), "dd MMM yyyy")}</td>
                    <td className="py-2 pr-3">{r.days}</td>
                    <td className="py-2 pr-3">{formatINR(r.gross)}</td>
                    <td className="py-2 pr-3 text-success">{formatINR(r.paid)}</td>
                    <td className="py-2 font-bold text-destructive">{formatINR(r.balance)}</td>
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

async function exportXlsx(name: string, head: string[], rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");
  ws.addRow(head);
  rows.forEach(r => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${name}.xlsx`; a.click(); URL.revokeObjectURL(url);
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
