import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PharmaKin — Gestion de pharmacie & pharmacies à proximité",
  description:
    "PharmaKin — l'application simple et rapide pour gérer une pharmacie à Kinshasa (stock, ventes, factures, rapports) et trouver les pharmacies à proximité.",
  keywords: [
    "PharmaKin",
    "pharmacie",
    "Kinshasa",
    "RDC",
    "gestion stock",
    "vente",
    "facture",
    "pharmacies à proximité",
  ],
  authors: [{ name: "HenoBuild Entreprise" }],
  applicationName: "PharmaKin",
  icons: {
    icon: "/favicon.ico",
  },
  manifest: undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1f6b53",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" />
      </body>
    </html>
  );
}
