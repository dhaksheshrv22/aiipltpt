import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate, formatTime, formatDuration } from "@/utils/pricing";
import { connectPrinter, isPrinterConnected, printExitReceipt } from "@/utils/bluetoothPrinter";
import { toast } from "sonner";
import { Printer, X, Bluetooth } from "lucide-react";

interface ReceiptModalProps {
  receipt: any;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const [printing, setPrinting] = useState(false);
  const [connecting, setConnecting] = useState(false);

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
      await printExitReceipt(receipt);
      toast.success("Receipt printed!");
    } catch (err: any) {
      toast.error("Print failed: " + err.message);
    }
    setPrinting(false);
  };

  // Fix category display - remove any non-ASCII characters
  const cleanCategory = (cat: string) => {
    if (!cat) return "";
    return cat.replace(/[^\x20-\x7E]/g, "-");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md print:shadow-none print:border-none">
        <div className="font-mono text-sm space-y-3 print:text-black" id="receipt">
          <div className="text-center space-y-1">
            <p className="text-lg font-bold">AIIPL TRUCK PARKING TERMINAL</p>
            <p className="text-xs text-muted-foreground">EXIT RECEIPT</p>
            <div className="border-t border-dashed my-2" />
          </div>

          <div className="space-y-1">
            <Row label="Receipt No." value={receipt.receiptNo} />
            <Row label="Vehicle" value={receipt.vehicle_number} />
            <Row label="Mobile No." value={receipt.driver_mobile} />
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

          <div className="space-y-1">
            <Row label="Gross Amount" value={formatINR(receipt.gross_amount)} />
            <Row label="Advance Paid" value={formatINR(receipt.advance_paid_amount ?? 0)} />
            <Row label="Balance Paid" value={formatINR(receipt.balancePaid)} />
            <Row label="Payment Mode" value={receipt.exit_payment_mode || receipt.payment_mode} />
          </div>

          <div className="border-t border-dashed" />

          <div className="text-center">
            <p className="font-bold text-base">TOTAL PAID: {formatINR(receipt.totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-2">Thank you for using our facility!</p>
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
