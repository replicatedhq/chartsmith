import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CommandMenuProvider } from '@/contexts/CommandMenuContext';
import { Toaster } from "@/components/toast/toaster";

// Space Grotesk - Bold, industrial display font
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// DM Sans - Clean, modern body font
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// JetBrains Mono - Superior code readability
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ChartSmith | Forge Your Helm Charts",
  description: "AI-powered Helm chart creation and validation. Craft production-ready Kubernetes deployments with precision.",
  keywords: ["Helm", "Kubernetes", "Charts", "DevOps", "AI", "ChartSmith"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            <CommandMenuProvider>
              {children}
              <Toaster />
            </CommandMenuProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
