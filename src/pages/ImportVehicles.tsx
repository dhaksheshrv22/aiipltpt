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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
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

  // Map various header names to our canonical fields
  const HEADER_MAP: Record<string, keyof Row> = {
    "vehicle number": "vehicle_number", "vehicle no": "vehicle_number", "vehicle": "vehicle_number",
    "vehicle_number": "vehicle_number", "reg no": "vehicle_number", "reg. no": "vehicle_number",
    "phone": "driver_mobile", "phone number": "driver_mobile", "mobile": "driver_mobile",
    "mobile number": "driver_mobile", "driver mobile": "driver_mobile", "contact": "driver_mobile",
    "entry date": "entry_date", "date": "entry_date",
    "entry time": "entry_time", "time": "entry_time",
    "category": "category", "wheel": "category", "wheels": "category",
    "wheel category": "category", "type": "category",
  };

  const cellToDate = (v: any): { date: string; time: string } => {
    if (v == null || v === "") return { date: "", time: "" };
    if (v instanceof Date) {
      return { date: format(v, "dd-MMM-yy"), time: format(v, "HH:mm") };
    }
    return { date: String(v).trim(), time: "" };
  };

  const cellToTime = (v: any): string => {
    if (v == null || v === "") return "";
    if (v instanceof Date) return format(v, "HH:mm");
    // Excel serial fractional time
    if (typeof v === "number" && v < 1) {
      const totalMin = Math.round(v * 24 * 60);
      const h = Math.floor(totalMin / 60), m = totalMin % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return String(v).trim();
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
      if (!json.length) { toast.error("Empty file"); return; }

      // Detect header row
      const headerRow = json[0].map((h: any) => String(h ?? "").trim().toLowerCase());
      const hasHeader = headerRow.some(h => HEADER_MAP[h]);
      let colMap: Record<keyof Row, number> = {
        vehicle_number: 0, driver_mobile: 1, entry_date: 2, entry_time: 3, category: 4,
      };
      let dataRows = json;
      if (hasHeader) {
        const map: Partial<Record<keyof Row, number>> = {};
        headerRow.forEach((h, i) => { const key = HEADER_MAP[h]; if (key && map[key] === undefined) map[key] = i; });
        colMap = { ...colMap, ...map } as any;
        dataRows = json.slice(1);
      }

      const out: Row[] = [];
      for (const r of dataRows) {
        const vn = String(r[colMap.vehicle_number] ?? "").trim();
        if (!vn) continue;
        const dateCell = r[colMap.entry_date];
        const timeCell = r[colMap.entry_time];
        const d = cellToDate(dateCell);
        let timeStr = cellToTime(timeCell);
        // If date cell already had time component (Date object), prefer it when time cell empty
        if (!timeStr && d.time) timeStr = d.time;
        out.push({
          vehicle_number: vn.toUpperCase().replace(/\s+/g, ""),
          driver_mobile: normalizeMobile(r[colMap.driver_mobile]),
          entry_date: d.date,
          entry_time: timeStr,
          category: String(r[colMap.category] ?? "").trim(),
        });
      }

      if (out.length === 0) { toast.error("No data rows found"); return; }
      setRows(out);
      setResults(null);
      setFileName(file.name);
      toast.success(`Loaded ${out.length} row(s) from ${file.name}`);
    } catch (e: any) {
      toast.error("Failed to read file: " + (e?.message || e));
    }
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
        <CardHeader><CardTitle className="text-base">1. Upload spreadsheet</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-xs text-muted-foreground">
            Upload an Excel (.xlsx, .xls) or CSV file. Expected columns: Vehicle Number, Phone Number, Entry Date, Entry Time, Wheel Category. A header row is auto-detected.
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.ods"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />Choose file
            </Button>
            <Button variant="outline" onClick={() => setRows([...rows, emptyRow()])}>Add empty row</Button>
            <Button variant="ghost" onClick={() => { setRows([]); setResults(null); setFileName(""); }}>Clear</Button>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
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
