import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useUpiSettings, buildUpiLink } from "@/hooks/useUpiSettings";
import { formatINR } from "@/utils/pricing";

interface UpiQRProps {
  amount: number;
  vehicleNumber: string;
  compact?: boolean;
  driverMobile?: string;
}

export default function UpiQR({ amount, vehicleNumber, compact, driverMobile }: UpiQRProps) {
  const { upiId, payeeName } = useUpiSettings();
  const [dataUrl, setDataUrl] = useState<string>("");

  const note = `Parking - ${vehicleNumber} - ${new Date().toLocaleDateString("en-IN")}`;
  const link = upiId && amount > 0 ? buildUpiLink({ upiId, payeeName, amount, note }) : "";

  useEffect(() => {
    if (!link) { setDataUrl(""); return; }
    QRCode.toDataURL(link, { width: compact ? 140 : 200, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(""));
  }, [link, compact]);

  if (!upiId) {
    return (
      <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3 text-center text-xs text-muted-foreground no-print">
        <QrCode className="w-5 h-5 mx-auto mb-1 opacity-60" />
        Configure UPI ID in Settings to show a payment QR.
      </div>
    );
  }

  if (amount <= 0 || !dataUrl) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("UPI link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const shareWhatsApp = () => {
    const msg = `Please pay ${formatINR(amount)} for parking — Vehicle ${vehicleNumber}.\nUPI Link: ${link}`;
    const cleanMobile = (driverMobile ?? "").replace(/\D/g, "");
    const phone = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="border rounded-lg p-3 flex flex-col items-center gap-2 bg-background">
      <p className="text-xs font-semibold text-muted-foreground">Scan to pay {formatINR(amount)}</p>
      <img src={dataUrl} alt={`UPI QR for ${formatINR(amount)}`} className={compact ? "w-32 h-32" : "w-44 h-44"} />
      <p className="text-[10px] text-muted-foreground font-mono">{upiId}</p>
      {!compact && (
        <div className="flex gap-2 no-print">
          <Button type="button" size="sm" variant="outline" onClick={copyLink} className="h-7 text-xs">
            <Copy className="w-3 h-3 mr-1" /> Copy Link
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={shareWhatsApp} className="h-7 text-xs">
            <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
          </Button>
        </div>
      )}
    </div>
  );
}
