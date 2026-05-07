import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/utils/pricing";
import { getPassStatus } from "@/utils/monthlyPass";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import { connectPrinter, isPrinterConnected, printMonthlyPass } from "@/utils/bluetoothPrinter";
import { toast } from "sonner";
import { Printer, X, Bluetooth } from "lucide-react";
import Barcode from "react-barcode";

interface Props {
  pass: any;
  onClose: () => void;
}

export default function MonthlyPassPrintModal({ pass, onClose }: Props) {
  const settings = useReceiptSettings();
  const status = getPassStatus(pass.pass_expiry_date);
  const isPaid = pass.payment_status === "Paid";
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
      await printMonthlyPass(pass);
      toast.success("Monthly pass printed!");
    } catch (err: any) {
      toast.error("Print failed: " + err.message);
    }
    setPrinting(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div id="monthly-pass-printable" className="bg-card text-card-foreground p-5 rounded-lg border-2 border-primary space-y-3">
          <div className="text-center">
            <h2 className="font-bold text-lg">{settings.companyName}</h2>
            {settings.contactInfo && <p className="text-[10px] text-muted-foreground">{settings.contactInfo}</p>}
            <div className="border-t border-dashed my-2" />
            <p className="font-bold tracking-wider">MONTHLY PARKING PASS</p>
          </div>

          <div className="text-center bg-primary/10 py-3 rounded">
            <p className="text-xs text-muted-foreground">Vehicle Number</p>
            <p className="text-2xl font-bold font-mono">{pass.vehicle_number}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">Pass ID:</span><span className="font-medium font-mono">{pass.pass_id}</span>
            {pass.owner_name && (<><span className="text-muted-foreground">Owner:</span><span className="font-medium">{pass.owner_name}</span></>)}
            <span className="text-muted-foreground">Mobile:</span><span className="font-medium">{pass.owner_mobile}</span>
            <span className="text-muted-foreground">Wheel Type:</span><span className="font-medium">{pass.num_wheels} ({pass.pricing_category})</span>
            <span className="text-muted-foreground">Start Date:</span><span className="font-medium">{formatDate(pass.pass_start_date)}</span>
            <span className="text-muted-foreground">Expiry Date:</span><span className="font-medium">{formatDate(pass.pass_expiry_date)}</span>
            <span className="text-muted-foreground">Amount:</span><span className="font-bold">{formatINR(pass.amount)}</span>
            <span className="text-muted-foreground">Payment:</span>
            <Badge variant={isPaid ? "default" : "destructive"} className="w-fit">{pass.payment_status}</Badge>
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={status === "Active" ? "default" : "destructive"} className="w-fit">{status}</Badge>
          </div>

          {settings.footerText && (
            <p className="text-center text-[10px] text-muted-foreground">{settings.footerText}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-4 print:hidden">
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
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #monthly-pass-printable, #monthly-pass-printable * { visibility: visible; }
            #monthly-pass-printable { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
