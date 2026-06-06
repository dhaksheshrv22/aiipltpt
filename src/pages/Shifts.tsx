import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR } from "@/utils/pricing";
import { format } from "date-fns";
import Seo from "@/components/Seo";
import { Badge } from "@/components/ui/badge";

export default function Shifts() {
  const { data: shifts = [] } = useQuery({
    queryKey: ["shiftsList"],
    queryFn: async () => {
      const { data } = await supabase.from("shifts").select("*").order("start_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const { data: recons = [] } = useQuery({
    queryKey: ["reconciliations"],
    queryFn: async () => {
      const { data } = await supabase.from("cash_reconciliations").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <Seo title="Shifts & Cash Reconciliation" description="Operator shift history and daily cash reconciliation log." />
      <div>
        <h1 className="text-2xl font-bold">Shifts & Cash Reconciliation</h1>
        <p className="text-sm text-muted-foreground">Use the Start Shift / End Shift button in the top bar to manage shifts.</p>
      </div>

      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts">Shift History</TabsTrigger>
          <TabsTrigger value="recon">Reconciliations</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Recent Shifts</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3">Operator</th>
                      <th className="pb-2 pr-3">Start</th>
                      <th className="pb-2 pr-3">End</th>
                      <th className="pb-2 pr-3">Duration</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No shifts yet.</td></tr>
                    ) : shifts.map((s: any) => {
                      const end = s.end_at ? new Date(s.end_at) : new Date();
                      const mins = Math.round((end.getTime() - new Date(s.start_at).getTime()) / 60000);
                      const dur = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
                      return (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{s.operator_name}</td>
                          <td className="py-2 pr-3">{format(new Date(s.start_at), "dd MMM HH:mm")}</td>
                          <td className="py-2 pr-3">{s.end_at ? format(new Date(s.end_at), "dd MMM HH:mm") : "—"}</td>
                          <td className="py-2 pr-3">{dur}</td>
                          <td className="py-2">
                            <Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recon" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Cash Reconciliations</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Operator</th>
                      <th className="pb-2 pr-3 text-right">Expected</th>
                      <th className="pb-2 pr-3 text-right">Counted</th>
                      <th className="pb-2 pr-3 text-right">Variance</th>
                      <th className="pb-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recons.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No reconciliations yet.</td></tr>
                    ) : recons.map((r: any) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{format(new Date(r.created_at), "dd MMM yyyy HH:mm")}</td>
                        <td className="py-2 pr-3">{r.operator_name}</td>
                        <td className="py-2 pr-3 text-right font-mono">{formatINR(r.expected_cash)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{formatINR(r.counted_cash)}</td>
                        <td className={`py-2 pr-3 text-right font-mono font-semibold ${Math.abs(r.variance) < 1 ? "text-success" : r.variance < 0 ? "text-destructive" : "text-amber-600"}`}>
                          {formatINR(r.variance)}
                        </td>
                        <td className="py-2 text-muted-foreground text-xs max-w-[260px] truncate">{r.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
