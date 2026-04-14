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
  CUT: new Uint8Array([GS, 0x56, 0x00]), // Full cut
  FEED: new Uint8Array([ESC, 0x64, 0x04]), // Feed 4 lines
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

// ESC/POS barcode using CODE39 (widely supported, handles alphanumeric + hyphens)
function barcodeBytes(code: string): Uint8Array {
  // Strip characters not valid in CODE39 (A-Z, 0-9, - . $ / + % space)
  const safeCode = code.toUpperCase().replace(/[^A-Z0-9\-.\$\/\+% ]/g, "");
  const codeData = textToBytes(safeCode);
  return concatBytes(
    // Set barcode height: GS h n
    new Uint8Array([GS, 0x68, 0x50]), // 80 dots tall
    // Set barcode width: GS w n (2=medium)
    new Uint8Array([GS, 0x77, 0x02]),
    // Print HRI below barcode: GS H n (2=below)
    new Uint8Array([GS, 0x48, 0x02]),
    // HRI font: GS f n (0=Font A)
    new Uint8Array([GS, 0x66, 0x00]),
    // Print barcode: GS k 4 (CODE39) with length-prefixed format (m=69)
    new Uint8Array([GS, 0x6b, 69, codeData.length]),
    codeData,
  );
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
  const chunkSize = 100;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (cachedCharacteristic.properties.writeWithoutResponse) {
      await cachedCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await cachedCharacteristic.writeValueWithResponse(chunk);
    }
    // Small delay between chunks
    await new Promise(r => setTimeout(r, 50));
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

  const data = concatBytes(
    COMMANDS.INIT,
    COMMANDS.CENTER,
    COMMANDS.BOLD_ON,
    textToBytes("AIIPL TRUCK PARKING TERMINAL\n"),
    COMMANDS.BOLD_OFF,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.CENTER,
    COMMANDS.LARGE,
    textToBytes("PARKING TOKEN\n"),
    COMMANDS.NORMAL_SIZE,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.LEFT,
    ...(vehicle.tokenNumber ? [textToBytes(`Token No.: ${vehicle.tokenNumber}\n`), dashedLine()] : []),
    COMMANDS.CENTER,
    COMMANDS.DOUBLE_HEIGHT,
    COMMANDS.BOLD_ON,
    textToBytes(`${vehicle.vehicle_number}\n`),
    COMMANDS.BOLD_OFF,
    COMMANDS.NORMAL_SIZE,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.LEFT,
    textToBytes(`Wheels    : ${vehicle.num_wheels} (${vehicle.pricing_category})\n`),
    textToBytes(`Rate      : Rs.${vehicle.daily_rate}/day\n`),
    textToBytes(`Mobile No.: ${vehicle.driver_mobile}\n`),
    textToBytes(`Entry Date: ${dateStr}\n`),
    textToBytes(`Entry Time: ${timeStr}\n`),
    ...(isPaid
      ? [
          textToBytes(`Pay Mode  : ${vehicle.payment_mode}\n`),
          textToBytes(`Advance   : ${vehicle.advance_paid ? `Rs.${vehicle.advance_amount}` : "None"}\n`),
        ]
      : [textToBytes(`Payment   : Due\n`)]),
    dashedLine(),
    ...(vehicle.tokenNumber
      ? [
          COMMANDS.CENTER,
          barcodeBytes(vehicle.tokenNumber),
          COMMANDS.LINE,
          dashedLine(),
        ]
      : []),
    COMMANDS.CENTER,
    COMMANDS.BOLD_ON,
    textToBytes("KEEP THIS TOKEN SAFE\n"),
    textToBytes("Required at exit\n"),
    COMMANDS.BOLD_OFF,
    dashedLine(),
    COMMANDS.FEED,
    COMMANDS.CUT,
  );

  await sendToPrinter(data);
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

  const data = concatBytes(
    COMMANDS.INIT,
    COMMANDS.CENTER,
    COMMANDS.LARGE,
    textToBytes("PARKING RECEIPT\n"),
    COMMANDS.NORMAL_SIZE,
    textToBytes("AIIPL TRUCK PARKING TERMINAL\n"),
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.LEFT,
    textToBytes(`Receipt  : ${receipt.receiptNo}\n`),
    dashedLine(),
    COMMANDS.CENTER,
    COMMANDS.DOUBLE_HEIGHT,
    COMMANDS.BOLD_ON,
    textToBytes(`${receipt.vehicle_number}\n`),
    COMMANDS.BOLD_OFF,
    COMMANDS.NORMAL_SIZE,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.LEFT,
    textToBytes(`Category : ${receipt.pricing_category}\n`),
    textToBytes(`Mobile   : ${receipt.driver_mobile}\n`),
    dashedLine(),
    textToBytes(`Entry Date: ${fmtDate(entryDate)}\n`),
    textToBytes(`Entry Time: ${fmtTime(entryDate)}\n`),
    textToBytes(`Exit Date : ${fmtDate(exitDate)}\n`),
    textToBytes(`Exit Time : ${fmtTime(exitDate)}\n`),
    textToBytes(`Duration : ${durationStr}\n`),
    dashedLine(),
    COMMANDS.BOLD_ON,
    textToBytes("BILLING DETAILS\n"),
    COMMANDS.BOLD_OFF,
    textToBytes(`Gross Amt: Rs.${receipt.gross_amount}\n`),
    textToBytes(`Advance  : Rs.${receipt.advance_paid_amount ?? 0}\n`),
    textToBytes(`Balance  : Rs.${receipt.balancePaid}\n`),
    textToBytes(`Pay Mode : ${receipt.exit_payment_mode || receipt.payment_mode}\n`),
    dashedLine(),
    COMMANDS.CENTER,
    COMMANDS.LARGE,
    COMMANDS.BOLD_ON,
    textToBytes(`TOTAL: Rs.${receipt.totalPaid}\n`),
    COMMANDS.BOLD_OFF,
    COMMANDS.NORMAL_SIZE,
    COMMANDS.LINE,
    dashedLine(),
    COMMANDS.CENTER,
    textToBytes("Thank you for using\n"),
    textToBytes("our parking facility!\n"),
    COMMANDS.FEED,
    COMMANDS.CUT,
  );

  await sendToPrinter(data);
}
