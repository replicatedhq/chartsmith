import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "./toast/use-toast";
import { getGoogleAuthUrl } from "@/lib/auth/google";
import Image from "next/image";

export function GoogleButton() {
  const { theme } = useTheme();
  const { toast } = useToast();

  const handleGoogleSignIn = () => {
    try {
      const authUrl = getGoogleAuthUrl();

      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to initiate Google login:", error);
      toast({
        title: "Error",
        description: "Failed to initiate Google login. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      className={`flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 font-medium transition-colors ${
        theme === "dark" ? "bg-surface text-text border border-dark-border hover:bg-dark-border/40" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
    >
      <Image src="https://www.google.com/favicon.ico" alt="Google" width={120} height={30} className="w-5 h-5" />
      Continue with Google
    </button>
  );
}
