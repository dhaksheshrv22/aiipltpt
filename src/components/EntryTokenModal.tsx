import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/utils/pricing";
import { connectPrinter, isPrinterConnected, printEntryToken } from "@/utils/bluetoothPrinter";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import { toast } from "sonner";
import { Bluetooth, Printer, X, Pencil, Save } from "lucide-react";

interface EntryTokenModalProps {
  vehicle: {
    vehicle_number: string;
    driver_mobile: string;
    num_wheels: number;
    pricing_category: string;
    daily_rate: number;
    entry_time: string;
    advance_paid: boolean;
    advance_amount: number;
    payment_mode: string;
    payment_status: string;
    token_number?: string | null;
  };
  onClose: () => void;
}

function fmtIN(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
}
function fmtTM(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase();
}

export default function EntryTokenModal({ vehicle, onClose }: EntryTokenModalProps) {
  const [printing, setPrinting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const receiptSettings = useReceiptSettings();
  const [tokenNumber] = useState(() => {
    if (vehicle.token_number) return vehicle.token_number;
    const year = new Date().getFullYear();
    const serial = Math.floor(1000 + Math.random() * 9000);
    return `${receiptSettings.prefix}-${year}-${String(serial).padStart(5, "0")}`;
  });

  const entryDt = new Date(vehicle.entry_time);
  const [editing, setEditing] = useState(false);
  const [editMobile, setEditMobile] = useState(vehicle.driver_mobile);
  const [editRate, setEditRate] = useState(String(vehicle.daily_rate));
  const [editAdvance, setEditAdvance] = useState(String(vehicle.advance_amount || 0));

  const rate = parseInt(editRate) || vehicle.daily_rate;
  const adv = parseInt(editAdvance) || 0;

  const handleConnect = async () => {
    setConnecting(true);
    try { await connectPrinter(); toast.success("Printer connected!"); }
    catch (err: any) { toast.error(err.message); }
    setConnecting(false);
  };

  const handlePrint = async () => {
    if (!isPrinterConnected()) { toast.error("Please connect a Bluetooth printer first"); return; }
    setPrinting(true);
    try {
      await printEntryToken({ ...vehicle, tokenNumber, driver_mobile: editMobile, daily_rate: rate });
      toast.success("Entry token printed!");
    } catch (err: any) { toast.error("Print failed: " + err.message); }
    setPrinting(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-4 bg-muted">
        <div className="aiipl-receipt print-area relative" id="receipt">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7 no-print"
            onClick={() => setEditing(!editing)}
            title={editing ? "Save edits" : "Edit receipt"}
          >
            {editing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </Button>

          <div className="ar-center ar-big">{receiptSettings.companyName || "AIIPL TRUCK PARKING"}</div>
          {receiptSettings.contactInfo
            ? <div className="ar-center ar-small" style={{ whiteSpace: "pre-line" }}>{receiptSettings.contactInfo}</div>
            : <>
                <div className="ar-center">SIPCOT PHASE 1</div>
                <div className="ar-center">HOSUR 635126</div>
              </>}
          <div className="ar-center ar-warning">MANAGEMENT NOT RESPONSIBLE FOR GOODS</div>
          <div className="ar-dashed" />
          <div className="ar-center ar-xxl">PARKING TOKEN</div>
          <div className="ar-dashed" />

          <div className="ar-row"><span>Token No. :</span><span className="ar-val">{tokenNumber}</span></div>
          <div className="ar-row">
            <span>Cust Mobile :</span>
            {editing
              ? <input className="ar-edit" value={editMobile} onChange={e => setEditMobile(e.target.value)} />
              : <span className="ar-val">{editMobile || "--"}</span>}
          </div>
          <div className="ar-row"><span>V TYPE :</span><span className="ar-val">{vehicle.pricing_category}</span></div>
          <div className="ar-row">
            <span>RATE :</span>
            {editing
              ? <input className="ar-edit" value={editRate} onChange={e => setEditRate(e.target.value)} />
              : <span className="ar-val">₹{rate} / Day</span>}
          </div>

          <div className="ar-dashed" />
          <div className="ar-highlight">V No : {vehicle.vehicle_number}</div>
          <div className="ar-highlight">IN DT : {fmtIN(entryDt)}</div>
          <div className="ar-highlight">IN TM : {fmtTM(entryDt)}</div>
          <div className="ar-dashed" />

          {(vehicle.advance_paid && adv > 0) && (
            <div className="ar-box">
              <div className="ar-row">
                <span>ADVANCE GIVEN :</span>
                {editing
                  ? <input className="ar-edit" value={editAdvance} onChange={e => setEditAdvance(e.target.value)} />
                  : <span className="ar-val">₹{adv}</span>}
              </div>
              <div className="ar-row"><span>BALANCE DUE :</span><span className="ar-val">At Exit</span></div>
            </div>
          )}

          <div className="ar-stamp"><span>Payment Due</span></div>
          <div className="ar-dashed" />
          <div className="ar-center ar-small">MINIMUM 1 HOUR &nbsp;|&nbsp; MAXIMUM 24 HOUR</div>
          <div className="ar-center ar-small">GRACE PERIOD : 1 HOUR AFTER 24 HRS</div>
          <div className="ar-center ar-small">MAXIMUM DUE PERIOD : 7 DAYS</div>
        </div>

        <div className="flex flex-col gap-2 no-print mt-4">
          <Button
            variant={isPrinterConnected() ? "outline" : "default"}
            onClick={handleConnect}
            disabled={connecting || isPrinterConnected()}
            className="w-full"
          >
            <Bluetooth className="w-4 h-4 mr-2" />
            {isPrinterConnected() ? "Printer Connected" : connecting ? "Connecting..." : "Connect Bluetooth Printer"}
          </Button>

          <Button onClick={handlePrint} disabled={printing || !isPrinterConnected()} className="w-full">
            <Printer className="w-4 h-4 mr-2" />
            {printing ? "Printing..." : "Print Token"}
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} className="flex-1">
              <Printer className="w-4 h-4 mr-1" /> Browser Print
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <X className="w-4 h-4 mr-1" /> Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
