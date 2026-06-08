import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/utils/pricing";
import { connectPrinter, isPrinterConnected, printExitReceipt } from "@/utils/bluetoothPrinter";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import { toast } from "sonner";
import { Printer, X, Bluetooth, Pencil, Save, Check } from "lucide-react";
import UpiQR from "@/components/UpiQR";

interface ReceiptModalProps {
  receipt: any;
  onClose: () => void;
}

function fmtIN(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
}
function fmtTM(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase();
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const [printing, setPrinting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const receiptSettings = useReceiptSettings();

  const [editing, setEditing] = useState(false);
  const [editMobile, setEditMobile] = useState(receipt.driver_mobile);
  const [editRate, setEditRate] = useState(String(receipt.daily_rate));
  const [editGross, setEditGross] = useState(String(receipt.gross_amount));
  const [editAdvance, setEditAdvance] = useState(String((receipt.advance_paid_amount ?? 0) + (receipt.temp_exit_payment_amount ?? 0)));

  const entryDt = new Date(receipt.entry_time);
  const exitDt = new Date(receipt.exit_time);
  const rate = parseInt(editRate) || receipt.daily_rate;
  const gross = parseInt(editGross) || receipt.gross_amount || 0;
  const adv = parseInt(editAdvance) || 0;
  const balance = Math.max(0, gross - adv);
  const days = receipt.total_days_billed || Math.max(1, Math.round(gross / Math.max(rate, 1)));

  const handleConnect = async () => {
    setConnecting(true);
    try { await connectPrinter(); toast.success("Printer connected!"); }
    catch (err: any) { toast.error(err.message); }
    setConnecting(false);
  };

  const handleBluetoothPrint = async () => {
    if (!isPrinterConnected()) { toast.error("Please connect a Bluetooth printer first"); return; }
    setPrinting(true);
    try {
      await printExitReceipt({
        ...receipt,
        driver_mobile: editMobile,
        gross_amount: gross,
        advance_paid_amount: adv,
        balancePaid: balance,
        totalPaid: gross,
      });
      toast.success("Receipt printed!");
    } catch (err: any) { toast.error("Print failed: " + err.message); }
    setPrinting(false);
  };

  const settled = balance <= 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-4 bg-muted print:bg-white">
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
          <div className="ar-center ar-xxl">EXIT RECEIPT</div>
          <div className="ar-dashed" />

          <div className="ar-row"><span>Token No. :</span><span className="ar-val">{receipt.receiptNo}</span></div>
          <div className="ar-row">
            <span>Cust Mobile :</span>
            {editing
              ? <input className="ar-edit" value={editMobile} onChange={e => setEditMobile(e.target.value)} />
              : <span className="ar-val">{editMobile || "--"}</span>}
          </div>
          <div className="ar-row"><span>V TYPE :</span><span className="ar-val">{receipt.pricing_category}</span></div>
          <div className="ar-row">
            <span>RATE :</span>
            {editing
              ? <input className="ar-edit" value={editRate} onChange={e => setEditRate(e.target.value)} />
              : <span className="ar-val">₹{rate} / Day</span>}
          </div>

          <div className="ar-dashed" />
          <div className="ar-highlight">V No : {receipt.vehicle_number}</div>
          <div className="ar-highlight">IN DT : {fmtIN(entryDt)}</div>
          <div className="ar-highlight">IN TM : {fmtTM(entryDt)}</div>
          <div className="ar-highlight">OUT DT : {fmtIN(exitDt)}</div>
          <div className="ar-highlight">OUT TM : {fmtTM(exitDt)}</div>
          <div className="ar-highlight">DURATION : {formatDuration(entryDt, exitDt)}</div>
          <div className="ar-dashed" />

          <div className="ar-box">
            <div className="ar-row"><span>DAYS CHARGED :</span><span className="ar-val">{days} Day{days > 1 ? "s" : ""}</span></div>
            <div className="ar-row"><span>RATE / DAY :</span><span className="ar-val">₹{rate}</span></div>
            <div className="ar-row">
              <span>TOTAL CHARGE :</span>
              {editing
                ? <input className="ar-edit" value={editGross} onChange={e => setEditGross(e.target.value)} />
                : <span className="ar-val">₹{gross}</span>}
            </div>
            <div className="ar-dashed" />
            <div className="ar-row">
              <span>ADVANCE GIVEN :</span>
              {editing
                ? <input className="ar-edit" value={editAdvance} onChange={e => setEditAdvance(e.target.value)} />
                : <span className="ar-val">₹{adv}</span>}
            </div>
            <div className="ar-total">
              <span>BALANCE DUE :</span>
              <span>{settled ? "₹0 (Settled)" : `₹${balance}`}</span>
            </div>
          </div>

          <div className="ar-stamp">
            {settled
              ? <span><Check className="inline w-4 h-4 -mt-1" /> PAID</span>
              : <span>Balance Due: ₹{balance}</span>}
          </div>

          <div className="ar-dashed" />
          <div className="ar-center ar-small">THANK YOU FOR PARKING WITH US</div>
          <div className="ar-center ar-small">DRIVE SAFE!</div>

          {!settled && (
            <div className="mt-2 no-print">
              <UpiQR amount={balance} vehicleNumber={receipt.vehicle_number} driverMobile={editMobile} />
            </div>
          )}
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

          <Button onClick={handleBluetoothPrint} disabled={printing || !isPrinterConnected()} className="w-full">
            <Printer className="w-4 h-4 mr-2" />
            {printing ? "Printing..." : "Print via Bluetooth"}
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} className="flex-1">
              <Printer className="w-4 h-4 mr-1" /> Browser Print
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
