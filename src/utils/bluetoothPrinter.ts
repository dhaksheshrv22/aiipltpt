// ESC/POS Bluetooth Thermal Printer Utility
// Uses Web Bluetooth API to connect and print to thermal printers

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// ESC/POS Commands
const COMMANDS = {
  INIT: new Uint8Array([ESC, 0x40]), // Initialize printer
  CENTER: new Uint8Array([ESC, 0x61, 0x01]), // Center align
  LEFT: new Uint8Array([ESC, 0x61, 0x00]), // Left align
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT: new Uint8Array([ESC, 0x21, 0x10]),
  NORMAL_SIZE: new Uint8Array([ESC, 0x21, 0x00]),
  LARGE: new Uint8Array([ESC, 0x21, 0x30]), // Double width + height
  // Bold + double-height ("MEDIUM"): big & bold body text, still 32 chars/line
  MEDIUM: new Uint8Array([ESC, 0x21, 0x18]),
  CUT: new Uint8Array([GS, 0x56, 0x00]),
  FEED: new Uint8Array([ESC, 0x64, 0x04]),
  LINE: new Uint8Array([LF]),
};

const PRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";

// Common alternate UUIDs for thermal printers
const ALT_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

const ALT_CHAR_UUIDS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
];

let cachedDevice: any = null;
let cachedCharacteristic: any = null;

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function dashedLine(): Uint8Array {
  return textToBytes("--------------------------------\n");
}

function canvasToRasterBytes(canvas: HTMLCanvasElement): Uint8Array {
  const context = canvas.getContext("2d");

  if (!context) {
    return new Uint8Array();
  }

  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);
  const raster = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      const alpha = imageData[pixelIndex + 3];
      const brightness = (imageData[pixelIndex] + imageData[pixelIndex + 1] + imageData[pixelIndex + 2]) / 3;
      const isDarkPixel = alpha > 0 && brightness < 200;

      if (isDarkPixel) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  return concatBytes(
    new Uint8Array([
      GS,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
    ]),
    raster,
    COMMANDS.LINE,
  );
}

// Print barcode as raster image instead of native barcode commands for better BLE printer compatibility
async function barcodeBytes(code: string): Promise<Uint8Array> {
  const safeCode = code.toUpperCase().replace(/[^A-Z0-9\-.\$\/\+% ]/g, "");

  if (!safeCode) {
    return textToBytes(`${code}\n`);
  }

  if (typeof document === "undefined") {
    return textToBytes(`${safeCode}\n`);
  }

  try {
    const barcodeModule = await import("jsbarcode");
    const JsBarcode = (barcodeModule.default ?? barcodeModule) as any;
    const canvas = document.createElement("canvas");

    JsBarcode(canvas, safeCode, {
      format: "CODE39",
      width: 2,
      height: 56,
      margin: 8,
      displayValue: false,
      lineColor: "#000000",
      background: "#FFFFFF",
    });

    return canvasToRasterBytes(canvas);
  } catch {
    return textToBytes(`${safeCode}\n`);
  }
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function findWritableCharacteristic(
  server: any
): Promise<any> {
  for (const serviceUuid of ALT_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const charUuid of ALT_CHAR_UUIDS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          if (char.properties.write || char.properties.writeWithoutResponse) {
            return char;
          }
        } catch {
          continue;
        }
      }
      // Try discovering all characteristics
      try {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            return char;
          }
        }
      } catch {
        continue;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function connectPrinter(): Promise<boolean> {
  if (!(navigator as any).bluetooth) {
    throw new Error("Bluetooth not supported on this device/browser. Use Chrome on Android for best results.");
  }

  try {
    const bt = (navigator as any).bluetooth;
    const device = await bt.requestDevice({
      filters: [{ services: [PRINTER_SERVICE_UUID] }],
      optionalServices: ALT_SERVICE_UUIDS,
    }).catch(() =>
      bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: ALT_SERVICE_UUIDS,
      })
    );

    if (!device) throw new Error("No printer selected");

    const server = await device.gatt!.connect();
    const characteristic = await findWritableCharacteristic(server);

    if (!characteristic) {
      throw new Error("Could not find a writable characteristic on this printer. Try a different printer.");
    }

    cachedDevice = device;
    cachedCharacteristic = characteristic;
    return true;
  } catch (err: any) {
    cachedDevice = null;
    cachedCharacteristic = null;
    throw new Error(err.message || "Failed to connect to printer");
  }
}

export function isPrinterConnected(): boolean {
  return !!(cachedDevice?.gatt?.connected && cachedCharacteristic);
}

export async function disconnectPrinter(): Promise<void> {
  if (cachedDevice?.gatt?.connected) {
    cachedDevice.gatt.disconnect();
  }
  cachedDevice = null;
  cachedCharacteristic = null;
}

async function sendToPrinter(data: Uint8Array): Promise<void> {
  if (!cachedCharacteristic) {
    throw new Error("Printer not connected. Please connect first.");
  }

  // Send in chunks (BLE has MTU limits, typically 20-512 bytes)
  const chunkSize = 64;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (cachedCharacteristic.properties.writeWithoutResponse) {
      await cachedCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await cachedCharacteristic.writeValueWithResponse(chunk);
    }
    // Small delay between chunks
    await new Promise(r => setTimeout(r, 80));
  }
}

async function sendPrintJob(...segments: Uint8Array[]): Promise<void> {
  for (const segment of segments) {
    if (segment.length === 0) continue;
    await sendToPrinter(segment);
  }
}

// ---- Receipt Builders ----

export async function printEntryToken(vehicle: {
  vehicle_number: string;
  driver_mobile: string;
  num_wheels: number;
  pricing_category: string;
  daily_rate: number;
  entry_time: string;
  advance_paid: boolean;
  advance_amount: number;
  payment_mode: string;
  tokenNumber?: string;
}): Promise<void> {
  const entryDate = new Date(vehicle.entry_time);
  const dateStr = entryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = entryDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const isPaid = vehicle.advance_paid || vehicle.payment_mode !== "Due";

  const buildCopy = async (copyLabel: string, isFirst: boolean): Promise<Uint8Array[]> => {
    const header = concatBytes(
      isFirst ? COMMANDS.INIT : new Uint8Array(),
      COMMANDS.MEDIUM,
      COMMANDS.CENTER,
      textToBytes("AIIPL TRUCK PARKING\n"),
      COMMANDS.LINE,
      dashedLine(),
      COMMANDS.CENTER,
      COMMANDS.LARGE,
      textToBytes("PARKING TOKEN\n"),
      COMMANDS.MEDIUM,
      COMMANDS.LINE,
      COMMANDS.CENTER,
      textToBytes(`** ${copyLabel} **\n`),
      dashedLine(),
      COMMANDS.LEFT,
      ...(vehicle.tokenNumber ? [textToBytes(`Token No.: ${vehicle.tokenNumber}\n`), dashedLine()] : []),
      COMMANDS.CENTER,
      COMMANDS.LARGE,
      textToBytes(`${vehicle.vehicle_number}\n`),
      COMMANDS.MEDIUM,
      COMMANDS.LINE,
      dashedLine(),
      COMMANDS.LEFT,
      textToBytes(`Wheels   : ${vehicle.num_wheels} (${vehicle.pricing_category})\n`),
      textToBytes(`Rate     : Rs.${vehicle.daily_rate}/day\n`),
      textToBytes(`Mobile   : ${vehicle.driver_mobile}\n`),
      textToBytes(`Entry Dt : ${dateStr}\n`),
      textToBytes(`Entry Tm : ${timeStr}\n`),
      ...(isPaid
        ? [
            textToBytes(`Pay Mode : ${vehicle.payment_mode}\n`),
            textToBytes(`Advance  : ${vehicle.advance_paid ? `Rs.${vehicle.advance_amount}` : "None"}\n`),
          ]
        : [textToBytes(`Payment  : Due\n`)]),
      dashedLine(),
    );

    const barcode = new Uint8Array();

    const footer = concatBytes(
      COMMANDS.CENTER,
      COMMANDS.MEDIUM,
      textToBytes(copyLabel === "CUSTOMER COPY" ? "KEEP TOKEN SAFE\n" : "OFFICE RECORD\n"),
      textToBytes(copyLabel === "CUSTOMER COPY" ? "Required at exit\n" : "File for records\n"),
      COMMANDS.NORMAL_SIZE,
      dashedLine(),
      COMMANDS.FEED,
      COMMANDS.CUT,
    );

    return [header, barcode, footer];
  };

  const customer = await buildCopy("CUSTOMER COPY", true);
  const organisation = await buildCopy("ORGANISATION COPY", false);

  await sendPrintJob(...customer, ...organisation);
}

export async function printExitReceipt(receipt: {
  receiptNo: string;
  vehicle_number: string;
  driver_mobile: string;
  pricing_category: string;
  num_wheels?: number;
  daily_rate?: number;
  entry_time: string;
  exit_time: string;
  gross_amount: number;
  advance_paid_amount: number;
  balancePaid: number;
  totalPaid: number;
  payment_mode: string;
  exit_payment_mode?: string;
  temp_exit_time?: string | null;
  return_time?: string | null;
  temp_exit_payment_amount?: number;
  temp_exit_payment_mode?: string | null;
  temp_exit_payment_at?: string | null;
}): Promise<void> {
  const entryDate = new Date(receipt.entry_time);
  const exitDate = new Date(receipt.exit_time);
  const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fmtTime = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  // Calculate duration
  const diffMs = exitDate.getTime() - entryDate.getTime();
  const totalMin = Math.floor(diffMs / 60000);
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

  const tempBlock: Uint8Array[] = [];
  if (hasTempExit) {
    tempBlock.push(
      COMMANDS.BOLD_ON,
      textToBytes("TEMP EXIT SUMMARY\n"),
      COMMANDS.BOLD_OFF,
    );
    if (receipt.temp_exit_time) {
      const t = new Date(receipt.temp_exit_time);
      tempBlock.push(textToBytes(`Out      : ${fmtDate(t)} ${fmtTime(t)}\n`));
    }
    if (receipt.return_time) {
      const t = new Date(receipt.return_time);
      tempBlock.push(textToBytes(`Re-entry : ${fmtDate(t)} ${fmtTime(t)}\n`));
    }
    if (receipt.temp_exit_time && receipt.return_time) {
      const a = new Date(receipt.temp_exit_time).getTime();
      const b = new Date(receipt.return_time).getTime();
      const m = Math.max(0, Math.floor((b - a) / 60000));
      const h = Math.floor(m / 60);
      const mm = m % 60;
      tempBlock.push(textToBytes(`Absence  : ${h}h ${mm}m\n`));
    }
    if (tempPaid > 0) {
      tempBlock.push(
        textToBytes(`Paid     : Rs.${tempPaid} (${receipt.temp_exit_payment_mode || "-"})\n`),
      );
      if (receipt.temp_exit_payment_at) {
        const t = new Date(receipt.temp_exit_payment_at);
        tempBlock.push(textToBytes(`Paid At  : ${fmtDate(t)} ${fmtTime(t)}\n`));
      }
    }
    tempBlock.push(dashedLine());
  }

  const data = concatBytes(
    COMMANDS.INIT,
    COMMANDS.MEDIUM,
    COMMANDS.CENTER,
    COMMANDS.LARGE,
    textToBytes("PARKING RECEIPT\n"),
    COMMANDS.MEDIUM,
    textToBytes("AIIPL TRUCK PARKING\n"),
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.LEFT,
    textToBytes(`Receipt  : ${receipt.receiptNo}\n`),
    dashedLine(),
    COMMANDS.CENTER,
    COMMANDS.LARGE,
    textToBytes(`${receipt.vehicle_number}\n`),
    COMMANDS.MEDIUM,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.LEFT,
    textToBytes(`Category : ${receipt.pricing_category}\n`),
    textToBytes(`Mobile   : ${receipt.driver_mobile}\n`),
    dashedLine(),
    textToBytes(`Entry Dt : ${fmtDate(entryDate)}\n`),
    textToBytes(`Entry Tm : ${fmtTime(entryDate)}\n`),
    textToBytes(`Exit Dt  : ${fmtDate(exitDate)}\n`),
    textToBytes(`Exit Tm  : ${fmtTime(exitDate)}\n`),
    textToBytes(`Duration : ${durationStr}\n`),
    dashedLine(),
    ...tempBlock,
    textToBytes("BILLING DETAILS\n"),
    textToBytes(`Gross Amt: Rs.${receipt.gross_amount}\n`),
    textToBytes(`Advance  : Rs.${receipt.advance_paid_amount ?? 0}\n`),
    ...(tempPaid > 0 ? [textToBytes(`Temp Paid: Rs.${tempPaid}\n`)] : []),
    textToBytes(`Balance  : Rs.${receipt.balancePaid}\n`),
    textToBytes(`Pay Mode : ${receipt.exit_payment_mode || receipt.payment_mode}\n`),
    dashedLine(),
    COMMANDS.CENTER,
    COMMANDS.LARGE,
    textToBytes(`TOTAL: Rs.${receipt.totalPaid}\n`),
    COMMANDS.MEDIUM,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.CENTER,
    textToBytes("Thank you for using\n"),
    textToBytes("our parking facility!\n"),
    COMMANDS.NORMAL_SIZE,
    COMMANDS.FEED,
    COMMANDS.CUT,
  );

  await sendToPrinter(data);
}

export async function printMonthlyPass(pass: {
  pass_id: string;
  vehicle_number: string;
  owner_name?: string;
  owner_mobile: string;
  num_wheels: number;
  pricing_category: string;
  pass_start_date: string;
  pass_expiry_date: string;
  amount: number;
  payment_status: string;
}): Promise<void> {
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const status =
    new Date(pass.pass_expiry_date).getTime() >= new Date().setHours(0, 0, 0, 0)
      ? "ACTIVE"
      : "EXPIRED";

  const headerBlock = concatBytes(
    COMMANDS.INIT,
    COMMANDS.MEDIUM,
    COMMANDS.CENTER,
    textToBytes("AIIPL TRUCK PARKING\n"),
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.CENTER,
    COMMANDS.LARGE,
    textToBytes("MONTHLY PASS\n"),
    COMMANDS.MEDIUM,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.CENTER,
    textToBytes(`${pass.pass_id}\n`),
    dashedLine(),
    COMMANDS.CENTER,
    COMMANDS.LARGE,
    textToBytes(`${pass.vehicle_number}\n`),
    COMMANDS.MEDIUM,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.LEFT,
    ...(pass.owner_name ? [textToBytes(`Owner    : ${pass.owner_name}\n`)] : []),
    textToBytes(`Mobile   : ${pass.owner_mobile}\n`),
    textToBytes(`Wheels   : ${pass.num_wheels} (${pass.pricing_category})\n`),
    dashedLine(),
    textToBytes(`Start    : ${fmtDate(pass.pass_start_date)}\n`),
    textToBytes(`EXPIRY   : ${fmtDate(pass.pass_expiry_date)}\n`),
    textToBytes(`Amount   : Rs.${pass.amount}\n`),
    textToBytes(`Payment  : ${pass.payment_status}\n`),
    textToBytes(`Status   : ${status}\n`),
    dashedLine(),
  );

  const barcodeBlock = new Uint8Array();

  const footerBlock = concatBytes(
    COMMANDS.CENTER,
    COMMANDS.MEDIUM,
    textToBytes("VALID FOR 30 DAYS\n"),
    textToBytes("Show at entry & exit\n"),
    COMMANDS.NORMAL_SIZE,
    dashedLine(),
    COMMANDS.FEED,
    COMMANDS.CUT,
  );

  await sendPrintJob(headerBlock, barcodeBlock, footerBlock);
}
