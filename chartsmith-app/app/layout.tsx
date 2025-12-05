import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CommandMenuProvider } from '@/contexts/CommandMenuContext';
import { Toaster } from "@/components/toast/toaster";

export const metadata: Metadata = {
  title: "ChartSmith by Replicated",
  description: "An assistant for creating and validating Helm charts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <CommandMenuProvider>
              {children}
            </CommandMenuProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
