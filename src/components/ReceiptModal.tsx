import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatINR, formatDateTime, formatDuration } from "@/utils/pricing";
import { Printer, X } from "lucide-react";

interface ReceiptModalProps {
  receipt: any;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const handlePrint = () => window.print();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md print:shadow-none print:border-none">
        <div className="font-mono text-sm space-y-3 print:text-black" id="receipt">
          <div className="text-center space-y-1">
            <p className="text-lg font-bold">HEAVY VEHICLE PARKING</p>
            <p className="text-xs text-muted-foreground">RECEIPT</p>
            <div className="border-t border-dashed my-2" />
          </div>

          <div className="space-y-1">
            <Row label="Receipt No" value={receipt.receiptNo} />
            <Row label="Vehicle" value={receipt.vehicle_number} />
            <Row label="Mobile" value={receipt.driver_mobile} />
            <Row label="Category" value={receipt.pricing_category} />
          </div>

          <div className="border-t border-dashed" />

          <div className="space-y-1">
            <Row label="Entry" value={formatDateTime(receipt.entry_time)} />
            <Row label="Exit" value={formatDateTime(receipt.exit_time)} />
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

        <div className="flex gap-2 no-print mt-4">
          <Button onClick={handlePrint} className="flex-1"><Printer className="w-4 h-4 mr-1" /> Print Receipt</Button>
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4" /></Button>
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
