import type { Metadata, Viewport } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { CellarProvider } from "@/components/CellarProvider";
import { Toaster } from "@/components/ui/toaster";

const dmSans = DM_Sans({ 
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const cormorant = Cormorant_Garamond({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Cellar | Virtual Wine Collection",
  description: "Manage your wine collection with AI-powered label recognition and pairing suggestions",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#C41E3A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${cormorant.variable}`}>
      <body className={dmSans.className}>
        <AuthProvider>
          <CellarProvider>
            {children}
            <Toaster />
          </CellarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
