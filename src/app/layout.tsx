import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PUTRA CORPORATION — Sistem Inventory & Kasir",
  description: "Inventory, kasir, retur/tukar, invoice & laporan bahan bangunan",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} ${inter.variable}`}
    >
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "var(--font-plex-sans)",
              borderRadius: "4px",
              border: "1px solid var(--border)",
            },
          }}
        />
      </body>
    </html>
  );
}
