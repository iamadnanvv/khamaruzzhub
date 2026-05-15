import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// EAN-13 check digit
export function ean13CheckDigit(twelve: string): string {
  if (!/^\d{12}$/.test(twelve)) throw new Error("Need 12 digits");
  const sum = twelve.split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

// UPC-A check digit (11 digits in)
export function upcaCheckDigit(eleven: string): string {
  if (!/^\d{11}$/.test(eleven)) throw new Error("Need 11 digits");
  const sum = eleven.split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export function generateEAN13(prefix: string, productSerial: number): string {
  const base = (prefix + productSerial.toString().padStart(12 - prefix.length, "0")).slice(0, 12);
  return base + ean13CheckDigit(base);
}

export function renderBarcodeToSvg(value: string, format: "CODE128" | "EAN13" | "UPC" = "CODE128") {
  if (typeof document === "undefined") return "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, { format, displayValue: true, fontSize: 14, height: 60, margin: 8 });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return "";
  }
}

export async function qrToDataUrl(value: string) {
  return QRCode.toDataURL(value, { margin: 1, width: 240 });
}
