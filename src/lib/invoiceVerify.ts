import "server-only";
import { SignJWT, jwtVerify } from "jose";

const PURPOSE = "invoice_verify";

function getVerifySecret(): Uint8Array {
  const secret = process.env.INVOICE_VERIFY_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error(
      "INVOICE_VERIFY_SECRET wajib di-set terpisah minimal 32 karakter di produksi."
    );
  }

  return new TextEncoder().encode(
    secret ?? "dev-invoice-verify-secret-ganti-di-produksi"
  );
}

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://putracorp.co.id").replace(/\/+$/, "");
}

export async function createInvoiceVerifyToken(noInvoice: string): Promise<string> {
  return new SignJWT({ purpose: PURPOSE, noInvoice })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(getVerifySecret());
}

export async function createInvoiceVerifyUrl(noInvoice: string): Promise<string> {
  const token = await createInvoiceVerifyToken(noInvoice);
  const path = `/verify/${encodeURIComponent(token)}`;
  return `${getBaseUrl()}${path}`;
}

export async function readInvoiceVerifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getVerifySecret());
    if (
      payload.purpose !== PURPOSE ||
      typeof payload.noInvoice !== "string" ||
      payload.noInvoice.length < 1 ||
      payload.noInvoice.length > 40
    ) {
      return null;
    }
    return payload.noInvoice;
  } catch {
    return null;
  }
}
