import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatDateTime, formatDuration } from "@/utils/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Download, History as HistoryIcon } from "lucide-react";
import ReceiptModal from "@/components/ReceiptModal";

export default function VehicleHistory() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [viewReceipt, setViewReceipt] = useState<any>(null);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["vehicleHistory", search, page],
    queryFn: async () => {
      let query = supabase.from("vehicle_history").select("*", { count: "exact" })
        .order("exit_time", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) query = query.ilike("vehicle_number", `%${search}%`);

      const { data, count } = await query;
      return { records: data ?? [], total: count ?? 0 };
    },
  });

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = ["Vehicle No", "Entry", "Exit", "Duration", "Category", "Gross", "Advance", "Balance", "Mode", "Status"];
    const rows = records.map(r => [
      r.vehicle_number, r.entry_time, r.exit_time,
      `${r.total_hours}h`, r.pricing_category,
      r.gross_amount, r.advance_paid_amount, r.balance_amount,
      r.exit_payment_mode || r.payment_mode, r.final_payment_status
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vehicle_history.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vehicle History</h1>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by vehicle number..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <HistoryIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No history records found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 pr-3">Vehicle</th>
                  <th className="pb-2 pr-3 hidden md:table-cell">Entry</th>
                  <th className="pb-2 pr-3 hidden md:table-cell">Exit</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">Gross</th>
                  <th className="pb-2 pr-3 hidden sm:table-cell">Advance</th>
                  <th className="pb-2 pr-3">Balance</th>
                  <th className="pb-2 pr-3 hidden sm:table-cell">Status</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-muted-foreground">{page * pageSize + i + 1}</td>
                    <td className="py-2 pr-3 font-mono font-bold">{r.vehicle_number}</td>
                    <td className="py-2 pr-3 hidden md:table-cell">{formatDateTime(r.entry_time)}</td>
                    <td className="py-2 pr-3 hidden md:table-cell">{formatDateTime(r.exit_time)}</td>
                    <td className="py-2 pr-3"><Badge variant="secondary">{r.pricing_category}</Badge></td>
                    <td className="py-2 pr-3">{formatINR(r.gross_amount)}</td>
                    <td className="py-2 pr-3 hidden sm:table-cell">{formatINR(r.advance_paid_amount ?? 0)}</td>
                    <td className="py-2 pr-3">{formatINR(r.balance_amount)}</td>
                    <td className="py-2 pr-3 hidden sm:table-cell">
                      <Badge variant={r.final_payment_status === "Paid" ? "default" : "destructive"}>{r.final_payment_status}</Badge>
                    </td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" aria-label={`View receipt for ${r.vehicle_number}`} onClick={() => setViewReceipt({
                        ...r, receiptNo: `HVP-${r.id.slice(0, 8).toUpperCase()}`,
                        balancePaid: r.balance_amount, totalPaid: r.gross_amount
                      })}>📄</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      {viewReceipt && <ReceiptModal receipt={viewReceipt} onClose={() => setViewReceipt(null)} />}
    </div>
  );
}
