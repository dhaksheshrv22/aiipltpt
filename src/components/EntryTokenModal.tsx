import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate, formatTime, generateReceiptNumber } from "@/utils/pricing";
import { connectPrinter, isPrinterConnected, printEntryToken } from "@/utils/bluetoothPrinter";
import { toast } from "sonner";
import { Bluetooth, Printer, X, Check } from "lucide-react";
import Barcode from "react-barcode";

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
  };
  onClose: () => void;
}

export default function EntryTokenModal({ vehicle, onClose }: EntryTokenModalProps) {
  const [printing, setPrinting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tokenNumber] = useState(() => generateReceiptNumber());

  const isPaid = vehicle.advance_paid || vehicle.payment_mode !== "Due";

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

  const handlePrint = async () => {
    if (!isPrinterConnected()) {
      toast.error("Please connect a Bluetooth printer first");
      return;
    }
    setPrinting(true);
    try {
      await printEntryToken({ ...vehicle, tokenNumber });
      toast.success("Entry token printed!");
    } catch (err: any) {
      toast.error("Print failed: " + err.message);
    }
    setPrinting(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Vehicle Registered!</h2>

          <div className="font-mono text-sm bg-muted p-4 rounded-lg text-left space-y-1">
            <div className="text-center mb-2">
              <p className="font-bold text-base">AIIPL TRUCK PARKING TERMINAL</p>
              <div className="border-t border-dashed my-2" />
              <p className="font-bold text-lg">PARKING TOKEN</p>
              <div className="border-t border-dashed my-2" />
            </div>
            <Row label="Token No." value={tokenNumber} />
            <div className="border-t border-dashed my-2" />
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
                <Row label="Advance" value={vehicle.advance_paid ? formatINR(vehicle.advance_amount) : "None"} />
              </>
            ) : (
              <Row label="Payment" value="Due" />
            )}
            <div className="border-t border-dashed my-2" />
            <div className="flex justify-center my-2">
              <Barcode
                value={tokenNumber}
                width={1.5}
                height={40}
                fontSize={10}
                displayValue={false}
                margin={0}
              />
            </div>
            <p className="text-center text-[10px]">{tokenNumber}</p>
            <div className="border-t border-dashed my-2" />
            <p className="text-center text-xs font-semibold">KEEP THIS TOKEN SAFE</p>
          </div>

          <div className="flex flex-col gap-2">
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

            <Button variant="ghost" onClick={onClose} className="w-full">
              <X className="w-4 h-4 mr-2" /> Skip & Close
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
