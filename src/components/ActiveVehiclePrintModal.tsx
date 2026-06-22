import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate, formatTime } from "@/utils/pricing";
import { connectPrinter, isPrinterConnected, printEntryToken } from "@/utils/bluetoothPrinter";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import { toast } from "sonner";
import { Bluetooth, Printer, X } from "lucide-react";

const DISCLAIMER = "Management is not responsible for the vehicle or any goods left inside.";

function wrapText(text: string, width: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}


interface ActiveVehiclePrintModalProps {
  vehicle: {
    vehicle_number: string;
    driver_mobile: string;
    num_wheels: number;
    pricing_category: string;
    daily_rate: number;
    entry_time: string;
    advance_paid: boolean | null;
    advance_amount: number | null;
    payment_mode: string;
    payment_status: string;
  };
  onClose: () => void;
}

export default function ActiveVehiclePrintModal({ vehicle, onClose }: ActiveVehiclePrintModalProps) {
  const [printing, setPrinting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const receiptSettings = useReceiptSettings();

  const isPaid = vehicle.payment_status === "Paid";

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
      await printEntryToken({
        vehicle_number: vehicle.vehicle_number,
        driver_mobile: vehicle.driver_mobile,
        num_wheels: vehicle.num_wheels,
        pricing_category: vehicle.pricing_category,
        daily_rate: vehicle.daily_rate,
        entry_time: vehicle.entry_time,
        advance_paid: vehicle.advance_paid ?? false,
        advance_amount: vehicle.advance_amount ?? 0,
        payment_mode: vehicle.payment_mode,
      });
      toast.success("Token printed!");
    } catch (err: any) {
      toast.error("Print failed: " + err.message);
    }
    setPrinting(false);
  };

  const handleBrowserPrint = () => window.print();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm print:shadow-none print:border-none">
        <div className="font-mono text-sm bg-muted p-4 rounded-lg text-left space-y-1 relative print-area" id="active-vehicle-print">
          <div className="text-center mb-2">
            <p className="font-bold text-base">{receiptSettings.companyName}</p>
            {receiptSettings.contactInfo && (
              <p className="text-[10px] text-muted-foreground">{receiptSettings.contactInfo}</p>
            )}
            <div className="border-t border-dashed my-2" />
            <p className="font-bold text-lg">{receiptSettings.headerText}</p>
            <p className="text-[10px] text-muted-foreground">REPRINT</p>
            <div className="border-t border-dashed my-2" />
          </div>

          <div className="text-center font-bold text-xl mb-2">{vehicle.vehicle_number}</div>
          <div className="border-t border-dashed my-2" />

          <Row label="Wheels" value={`${vehicle.num_wheels} (${vehicle.pricing_category})`} />
          <Row label="Rate" value={`${formatINR(vehicle.daily_rate)}/day`} />
          <Row label="Mobile No." value={vehicle.driver_mobile} />
          <Row label="Entry Date" value={formatDate(vehicle.entry_time)} />
          <Row label="Entry Time" value={formatTime(vehicle.entry_time)} />

          {isPaid ? (
            <>
              <Row label="Payment Mode" value={vehicle.payment_mode} />
              <Row label="Advance" value={vehicle.advance_paid ? formatINR(vehicle.advance_amount ?? 0) : "None"} />
            </>
          ) : (
            <Row label="Payment" value="Due" />
          )}

          <div className="border-t border-dashed my-2" />
          <p className="text-center text-xs font-semibold">KEEP THIS TOKEN SAFE</p>
          {receiptSettings.footerText && (
            <p className="text-center text-[10px] text-muted-foreground mt-1">{receiptSettings.footerText}</p>
          )}
          <pre className="font-mono text-[10px] italic leading-tight whitespace-pre text-foreground mt-2">
{wrapText(DISCLAIMER, 32)}
          </pre>
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
