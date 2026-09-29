import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { CellarProvider } from "@/components/CellarProvider";
import { Toaster } from "@/components/ui/toaster";

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
  viewportFit: "cover",
  themeColor: "#F2F2F7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
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
