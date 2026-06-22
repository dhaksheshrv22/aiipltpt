import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { connectPrinter, isPrinterConnected, printEntryToken } from "@/utils/bluetoothPrinter";
import { useReceiptSettings } from "@/hooks/useReceiptSettings";
import { toast } from "sonner";
import { Bluetooth, Printer, X } from "lucide-react";

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

const DASH = "--------------------------------";
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

  const entryDate = new Date(vehicle.entry_time);
  const dateStr = entryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = entryDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const showPaymentInfo = vehicle.advance_paid && vehicle.advance_amount > 0;

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
      await printEntryToken({ ...vehicle, tokenNumber });
      toast.success("Entry token printed!");
    } catch (err: any) { toast.error("Print failed: " + err.message); }
    setPrinting(false);
  };

  const Copy = ({ label, footer1, footer2 }: { label: string; footer1: string; footer2: string }) => (
    <>
      <pre className="font-mono text-[12px] leading-tight whitespace-pre text-foreground m-0">
{`        AIIPL TRUCK PARKING

${DASH}
         PARKING TOKEN

         ** ${label} **
${DASH}
Token No.: ${tokenNumber}
${DASH}
        ${vehicle.vehicle_number}

${DASH}
Wheels   : ${vehicle.num_wheels} (${vehicle.pricing_category})
Rate     : Rs.${vehicle.daily_rate}/day
Mobile   : ${vehicle.driver_mobile}
Entry Dt : ${dateStr}
Entry Tm : ${timeStr}
${showPaymentInfo
  ? `Pay Mode : ${vehicle.payment_mode}\nAdvance  : Rs.${vehicle.advance_amount}`
  : `Payment  : Due`}
${DASH}
         ${footer1}
         ${footer2}
${DASH}`}
      </pre>
      <pre className="font-mono text-[10px] italic leading-tight whitespace-pre text-foreground mt-1">
{wrapText(DISCLAIMER, 32)}
      </pre>
    </>
  );


  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-4 bg-muted">
        <div className="print-area bg-background p-3 rounded border space-y-4 max-h-[60vh] overflow-y-auto" id="receipt">
          <Copy label="CUSTOMER COPY" footer1="KEEP TOKEN SAFE" footer2="Required at exit" />
          <div className="text-center font-mono text-[10px] text-muted-foreground">— — — — — — —</div>
          <Copy label="ORGANISATION COPY" footer1="OFFICE RECORD" footer2="File for records" />
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
