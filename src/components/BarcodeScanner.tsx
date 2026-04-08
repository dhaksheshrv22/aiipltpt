import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const scannerId = "barcode-scanner-region";

    // Small delay to ensure DOM element exists
    const timeout = setTimeout(() => {
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          onScan(decodedText);
        },
        () => {} // ignore scan failures
      ).catch((err: any) => {
        setError("Camera access denied or not available: " + err);
      });
    }, 300);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      setError("");
    };
  }, [open, onScan]);

  if (!open) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>
        <div id="barcode-scanner-region" className="w-full min-h-[200px]" />
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
        <Button variant="ghost" onClick={onClose} className="w-full">
          <X className="w-4 h-4 mr-2" /> Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
