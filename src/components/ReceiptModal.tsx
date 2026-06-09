import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { connectPrinter, isPrinterConnected, printExitReceipt } from "@/utils/bluetoothPrinter";
import { toast } from "sonner";
import { Printer, X, Bluetooth } from "lucide-react";
import UpiQR from "@/components/UpiQR";

interface ReceiptModalProps {
  receipt: any;
  onClose: () => void;
}

const DASH = "--------------------------------";

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const [printing, setPrinting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const entryDate = new Date(receipt.entry_time);
  const exitDate = new Date(receipt.exit_time);
  const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fmtTime = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const diffMs = exitDate.getTime() - entryDate.getTime();
  const totalMin = Math.max(0, Math.floor(diffMs / 60000));
  const days = Math.floor(totalMin / 1440);
  const hrs = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const durationParts: string[] = [];
  if (days > 0) durationParts.push(`${days}d`);
  if (hrs > 0) durationParts.push(`${hrs}h`);
  durationParts.push(`${mins}m`);
  const durationStr = durationParts.join(" ");

  const tempPaid = receipt.temp_exit_payment_amount ?? 0;
  const hasTempExit = !!(receipt.temp_exit_time || receipt.return_time || tempPaid > 0);
  const gross = receipt.gross_amount ?? 0;
  const advance = receipt.advance_paid_amount ?? 0;
  const balance = Math.max(0, gross - advance - tempPaid);
  const total = receipt.totalPaid ?? gross;
  const payMode = receipt.exit_payment_mode || receipt.payment_mode;

  let tempBlock = "";
  if (hasTempExit) {
    tempBlock += `TEMP EXIT SUMMARY\n`;
    if (receipt.temp_exit_time) {
      const t = new Date(receipt.temp_exit_time);
      tempBlock += `Out      : ${fmtDate(t)} ${fmtTime(t)}\n`;
    }
    if (receipt.return_time) {
      const t = new Date(receipt.return_time);
      tempBlock += `Re-entry : ${fmtDate(t)} ${fmtTime(t)}\n`;
    }
    if (receipt.temp_exit_time && receipt.return_time) {
      const a = new Date(receipt.temp_exit_time).getTime();
      const b = new Date(receipt.return_time).getTime();
      const m = Math.max(0, Math.floor((b - a) / 60000));
      tempBlock += `Absence  : ${Math.floor(m / 60)}h ${m % 60}m\n`;
    }
    if (tempPaid > 0) {
      tempBlock += `Paid     : Rs.${tempPaid} (${receipt.temp_exit_payment_mode || "-"})\n`;
      if (receipt.temp_exit_payment_at) {
        const t = new Date(receipt.temp_exit_payment_at);
        tempBlock += `Paid At  : ${fmtDate(t)} ${fmtTime(t)}\n`;
      }
    }
    tempBlock += `${DASH}\n`;
  }

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
      await printExitReceipt({ ...receipt, balancePaid: balance, totalPaid: total });
      toast.success("Receipt printed!");
    } catch (err: any) { toast.error("Print failed: " + err.message); }
    setPrinting(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-4 bg-muted print:bg-white">
        <div className="print-area bg-background p-3 rounded border max-h-[60vh] overflow-y-auto" id="receipt">
          <pre className="font-mono text-[12px] leading-tight whitespace-pre text-foreground m-0">
{`        PARKING RECEIPT
        AIIPL TRUCK PARKING

${DASH}
Receipt  : ${receipt.receiptNo}
${DASH}
        ${receipt.vehicle_number}

${DASH}
Category : ${receipt.pricing_category}
Mobile   : ${receipt.driver_mobile}
${DASH}
Entry Dt : ${fmtDate(entryDate)}
Entry Tm : ${fmtTime(entryDate)}
Exit Dt  : ${fmtDate(exitDate)}
Exit Tm  : ${fmtTime(exitDate)}
Duration : ${durationStr}
${DASH}
${tempBlock}BILLING DETAILS
Gross Amt: Rs.${gross}
Advance  : Rs.${advance}${tempPaid > 0 ? `\nTemp Paid: Rs.${tempPaid}` : ""}
Balance  : Rs.${balance}
Pay Mode : ${payMode}
${DASH}
       TOTAL: Rs.${total}

${DASH}
       Thank you for using
       our parking facility!`}
          </pre>

          {balance > 0 && (
            <div className="mt-3 no-print">
              <UpiQR amount={balance} vehicleNumber={receipt.vehicle_number} driverMobile={receipt.driver_mobile} />
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
