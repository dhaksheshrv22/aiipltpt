import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { parse, format } from "date-fns";
import { getPricingDetails } from "@/utils/pricing";
import { Trash2, Upload, FileSpreadsheet } from "lucide-react";

type Row = {
  vehicle_number: string;
  driver_mobile: string;
  entry_date: string; // dd-MMM-yy or yyyy-MM-dd
  entry_time: string; // HH:mm
  category: string;   // free text (e.g. "4", "6", "4-6", "7-10")
};

const emptyRow = (): Row => ({ vehicle_number: "", driver_mobile: "", entry_date: "", entry_time: "", category: "" });

const DATE_FORMATS = ["dd-MMM-yy", "dd-MMM-yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "dd/MM/yy", "d-MMM-yy", "d-MMM-yyyy"];

function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const d = (dateStr || "").trim().replace(/,$/, "").trim();
  const t = (timeStr || "").trim();
  if (!d || !t) return null;
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(`${d} ${t}`, `${fmt} HH:mm`, new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const iso = new Date(`${d}T${t}:00`);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function categoryToWheels(input: string): number | null {
  const s = (input || "").trim().toLowerCase().replace(/wheeler|wheel|wheels|wh/g, "").replace(/–/g, "-").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s.endsWith("+")) return parseInt(s.slice(0, -1), 10) + 2;
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return parseInt(m[2], 10); // upper bound
  return null;
}

function normalizeMobile(v: any): string {
  if (v == null) return "";
  let s = String(v).replace(/\D/g, "");
  if (s.length > 10) s = s.slice(-10);
  return s;
}

function parsePaste(text: string): Row[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: Row[] = [];
  for (const line of lines) {
    // split by tab or comma
    const parts = line.includes("\t") ? line.split("\t") : line.split(",");
    const cleaned = parts.map(p => p.trim().replace(/^"|"$/g, ""));
    if (cleaned.length < 4) continue;
    // Heuristic: detect a header row
    if (/vehicle/i.test(cleaned[0]) && /number|no/i.test(cleaned[0])) continue;
    const [vn, ph, dt, tm, cat] = cleaned;
    if (!vn) continue;
    out.push({
      vehicle_number: vn.toUpperCase().replace(/\s+/g, ""),
      driver_mobile: normalizeMobile(ph),
      entry_date: dt || "",
      entry_time: tm || "",
      category: cat || "",
    });
  }
  return out;
}

export default function ImportVehicles() {
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ ok: number; fail: { vehicle: string; reason: string }[] } | null>(null);

  const previews = useMemo(() => rows.map(r => {
    const dt = parseDateTime(r.entry_date, r.entry_time);
    const wheels = categoryToWheels(r.category);
    const pricing = wheels ? getPricingDetails(wheels) : null;
    const errors: string[] = [];
    if (!r.vehicle_number) errors.push("vehicle no");
    if (!/^[6-9]\d{9}$/.test(r.driver_mobile)) errors.push("mobile");
    if (!dt) errors.push("date/time");
    if (!pricing) errors.push("category");
    return { row: r, dt, wheels, pricing, errors };
  }), [rows]);

  const validCount = previews.filter(p => p.errors.length === 0).length;

  const handleParse = () => {
    const parsed = parsePaste(paste);
    if (parsed.length === 0) {
      toast.error("Could not detect any rows. Paste tab- or comma-separated data.");
      return;
    }
    setRows(parsed);
    setResults(null);
    toast.success(`Parsed ${parsed.length} row(s)`);
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i));

  const handleImport = async () => {
    setImporting(true);
    const fail: { vehicle: string; reason: string }[] = [];
    let ok = 0;
    for (const p of previews) {
      if (p.errors.length > 0 || !p.dt || !p.pricing) {
        fail.push({ vehicle: p.row.vehicle_number || "(blank)", reason: "Invalid: " + p.errors.join(", ") });
        continue;
      }
      const { data: existing } = await supabase
        .from("active_vehicles")
        .select("id")
        .eq("vehicle_number", p.row.vehicle_number)
        .maybeSingle();
      if (existing) {
        fail.push({ vehicle: p.row.vehicle_number, reason: "Already active" });
        continue;
      }
      const { error } = await supabase.from("active_vehicles").insert({
        vehicle_number: p.row.vehicle_number,
        driver_mobile: p.row.driver_mobile,
        num_wheels: p.wheels!,
        pricing_category: p.pricing.category,
        daily_rate: p.pricing.dailyRate,
        payment_mode: null,
        advance_paid: false,
        advance_amount: 0,
        payment_status: "Due",
        is_monthly_pass: false,
        entry_time: p.dt.toISOString(),
        notes: "Imported",
      });
      if (error) fail.push({ vehicle: p.row.vehicle_number, reason: error.message });
      else ok++;
    }
    setImporting(false);
    setResults({ ok, fail });
    if (ok > 0) toast.success(`Imported ${ok} vehicle(s)`);
    if (fail.length > 0) toast.error(`${fail.length} failed`);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Import Vehicles</h1>
        <p className="text-sm text-muted-foreground">Bulk-add active vehicles from a spreadsheet (Numbers/Excel/CSV).</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Paste rows</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-xs text-muted-foreground">
            Columns (in order): Vehicle Number, Phone Number, Entry Date, Entry Time, Wheel Category.
            Date e.g. <code>17-Jun-26</code>, time <code>13:43</code>, category like <code>4</code>, <code>6</code>, <code>4-6</code>, <code>7-10</code>, <code>15-20</code>.
          </Label>
          <Textarea
            value={paste}
            onChange={e => setPaste(e.target.value)}
            placeholder={"HR55AD0714\t9958939901\t17-Jun-26\t13:43\t4-6\nTN23BU9318\t8973166866\t17-Jun-26\t16:28\t4"}
            rows={6}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={handleParse}><Upload className="w-4 h-4 mr-2" />Parse</Button>
            <Button variant="outline" onClick={() => { setRows([...rows, emptyRow()]); }}>Add empty row</Button>
            <Button variant="ghost" onClick={() => { setPaste(""); setRows([]); setResults(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              2. Review &amp; edit
              <Badge variant="secondary">{validCount}/{rows.length} valid</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previews.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell><Input value={p.row.vehicle_number} onChange={e => updateRow(i, { vehicle_number: e.target.value.toUpperCase() })} className="h-8 w-32" /></TableCell>
                    <TableCell><Input value={p.row.driver_mobile} onChange={e => updateRow(i, { driver_mobile: normalizeMobile(e.target.value) })} className="h-8 w-32" /></TableCell>
                    <TableCell><Input value={p.row.entry_date} onChange={e => updateRow(i, { entry_date: e.target.value })} className="h-8 w-32" /></TableCell>
                    <TableCell><Input value={p.row.entry_time} onChange={e => updateRow(i, { entry_time: e.target.value })} className="h-8 w-20" /></TableCell>
                    <TableCell><Input value={p.row.category} onChange={e => updateRow(i, { category: e.target.value })} className="h-8 w-24" /></TableCell>
                    <TableCell>
                      {p.errors.length === 0 ? (
                        <Badge className="bg-green-600">{p.pricing?.category}</Badge>
                      ) : (
                        <Badge variant="destructive">{p.errors.join(", ")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex gap-2">
              <Button onClick={handleImport} disabled={importing || validCount === 0}>
                {importing ? "Importing..." : `Import ${validCount} vehicle(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card>
          <CardHeader><CardTitle className="text-base">Result</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-green-700">✓ Imported: {results.ok}</div>
            {results.fail.length > 0 && (
              <div className="space-y-1">
                <div className="text-destructive font-semibold">✗ Failed: {results.fail.length}</div>
                <ul className="list-disc pl-5">
                  {results.fail.map((f, i) => (
                    <li key={i}><span className="font-mono">{f.vehicle}</span> — {f.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
