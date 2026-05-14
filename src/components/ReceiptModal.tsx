import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, formatDate, formatTime, formatDuration } from "@/utils/pricing";
import { connectPrinter, isPrinterConnected, printExitReceipt } from "@/utils/bluetoothPrinter";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import { toast } from "sonner";
import { Printer, X, Bluetooth, Pencil, Save } from "lucide-react";

interface ReceiptModalProps {
  receipt: any;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const [printing, setPrinting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const receiptSettings = useReceiptSettings();

  // Editable fields
  const [editing, setEditing] = useState(false);
  const [editMobile, setEditMobile] = useState(receipt.driver_mobile);
  const [editGross, setEditGross] = useState(String(receipt.gross_amount));
  const [editAdvance, setEditAdvance] = useState(String(receipt.advance_paid_amount ?? 0));
  const [editBalance, setEditBalance] = useState(String(receipt.balancePaid));
  const [editTotal, setEditTotal] = useState(String(receipt.totalPaid));

  const handleBrowserPrint = () => window.print();

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectPrinter();
      toast.success("Printer connected!");
    } catch (err: any) {
      toast.error(err.message);
    }
    setConnecting(false);
  };

  const handleBluetoothPrint = async () => {
    if (!isPrinterConnected()) {
      toast.error("Please connect a Bluetooth printer first");
      return;
    }
    setPrinting(true);
    try {
      await printExitReceipt({
        ...receipt,
        driver_mobile: editMobile,
        gross_amount: parseInt(editGross) || receipt.gross_amount,
        advance_paid_amount: parseInt(editAdvance) || 0,
        balancePaid: parseInt(editBalance) || receipt.balancePaid,
        totalPaid: parseInt(editTotal) || receipt.totalPaid,
      });
      toast.success("Receipt printed!");
    } catch (err: any) {
      toast.error("Print failed: " + err.message);
    }
    setPrinting(false);
  };

  const cleanCategory = (cat: string) => {
    if (!cat) return "";
    return cat.replace(/[^\x20-\x7E]/g, "-");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md print:shadow-none print:border-none">
        <div className="font-mono text-sm space-y-3 print:text-black relative" id="receipt">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 h-7 w-7 no-print"
            onClick={() => setEditing(!editing)}
            title={editing ? "Save edits" : "Edit receipt"}
          >
            {editing ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </Button>

          <div className="text-center space-y-1">
            <p className="text-lg font-bold">{receiptSettings.companyName}</p>
            {receiptSettings.contactInfo && (
              <p className="text-[10px] text-muted-foreground">{receiptSettings.contactInfo}</p>
            )}
            <p className="text-xs text-muted-foreground">EXIT RECEIPT</p>
            <div className="border-t border-dashed my-2" />
          </div>

          <div className="space-y-1">
            <Row label="Receipt No." value={receipt.receiptNo} />
            <Row label="Vehicle" value={receipt.vehicle_number} />
            {editing ? (
              <EditRow label="Mobile No." value={editMobile} onChange={setEditMobile} />
            ) : (
              <Row label="Mobile No." value={editMobile} />
            )}
            <Row label="Category" value={cleanCategory(receipt.pricing_category)} />
          </div>

          <div className="border-t border-dashed" />

          <div className="space-y-1">
            <Row label="Entry Date" value={formatDate(receipt.entry_time)} />
            <Row label="Entry Time" value={formatTime(receipt.entry_time)} />
            <Row label="Exit Date" value={formatDate(receipt.exit_time)} />
            <Row label="Exit Time" value={formatTime(receipt.exit_time)} />
            <Row label="Duration" value={formatDuration(new Date(receipt.entry_time), new Date(receipt.exit_time))} />
          </div>

          <div className="border-t border-dashed" />

          {(receipt.temp_exit_time || receipt.return_time) && (
            <>
              <div className="space-y-1">
                <p className="font-semibold text-center">— Temporary Exit Summary —</p>
                {receipt.temp_exit_time && (
                  <Row label="Temp Exit" value={`${formatDate(receipt.temp_exit_time)} ${formatTime(receipt.temp_exit_time)}`} />
                )}
                {receipt.return_time && (
                  <Row label="Re-entry" value={`${formatDate(receipt.return_time)} ${formatTime(receipt.return_time)}`} />
                )}
                {receipt.temp_exit_time && receipt.return_time && (
                  <Row label="Absence" value={formatDuration(new Date(receipt.temp_exit_time), new Date(receipt.return_time))} />
                )}
                {(receipt.temp_exit_payment_amount ?? 0) > 0 && (
                  <>
                    <Row label="Paid (Temp)" value={formatINR(receipt.temp_exit_payment_amount)} />
                    {receipt.temp_exit_payment_at && (
                      <Row label="Paid At" value={`${formatDate(receipt.temp_exit_payment_at)} ${formatTime(receipt.temp_exit_payment_at)}`} />
                    )}
                  </>
                )}
              </div>
              <div className="border-t border-dashed" />
            </>
          )}

          <div className="space-y-1">
            {editing ? (
              <>
                <EditRow label="Gross Amount" value={editGross} onChange={setEditGross} />
                <EditRow label="Advance Paid" value={editAdvance} onChange={setEditAdvance} />
                <EditRow label="Balance Paid" value={editBalance} onChange={setEditBalance} />
              </>
            ) : (
              <>
                <Row label="Gross Amount" value={formatINR(parseInt(editGross) || receipt.gross_amount)} />
                <Row label="Advance Paid" value={formatINR(parseInt(editAdvance) || 0)} />
                {(receipt.temp_exit_payment_amount ?? 0) > 0 && (
                  <Row label="Temp Exit Paid" value={formatINR(receipt.temp_exit_payment_amount)} />
                )}
                <Row label="Balance Paid" value={formatINR(parseInt(editBalance) || receipt.balancePaid)} />
              </>
            )}
            <Row label="Payment Mode" value={receipt.exit_payment_mode || receipt.payment_mode} />
          </div>

          <div className="border-t border-dashed" />

          <div className="text-center">
            {editing ? (
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-base">TOTAL PAID: ₹</span>
                <Input value={editTotal} onChange={e => setEditTotal(e.target.value)} className="h-7 w-24 text-center font-bold text-base px-1" />
              </div>
            ) : (
              <p className="font-bold text-base">TOTAL PAID: {formatINR(parseInt(editTotal) || receipt.totalPaid)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">{receiptSettings.footerText}</p>
          </div>
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
            <Button variant="outline" onClick={handleBrowserPrint} className="flex-1">
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function EditRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted-foreground whitespace-nowrap">{label}:</span>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-7 text-xs font-medium text-right w-28 px-2" />
    </div>
  );
}
