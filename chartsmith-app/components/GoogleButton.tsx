import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "./toast/use-toast";
import { getGoogleAuthUrl } from "@/lib/auth/google";
import Image from "next/image";
import { logger } from "@/lib/utils/logger";

export function GoogleButton() {
  const { theme } = useTheme();
  const { toast } = useToast();

  const handleGoogleSignIn = () => {
    try {
      const authUrl = getGoogleAuthUrl();
      
      // Open popup window
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        "Google Sign In",
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      // Listen for messages from popup
      const messageHandler = async (event: MessageEvent) => {
        if (event.data?.type === 'google-auth') {
          window.removeEventListener('message', messageHandler);
          if (popup) popup.close();
          
          if (event.data.error) {
            toast({
              title: "Error",
              description: "Failed to sign in with Google. Please try again.",
              variant: "destructive",
            });
            return;
          }

          // Set the session cookie
          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          document.cookie = `session=${event.data.jwt}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

          // Handle any pending actions
          const pendingArtifactHubUrl = sessionStorage.getItem('pendingArtifactHubUrl');
          const pendingPrompt = sessionStorage.getItem('pendingPrompt');
          
          if (pendingArtifactHubUrl) {
            sessionStorage.removeItem('pendingArtifactHubUrl');
            window.location.href = `/artifacthub.io/packages/helm/${encodeURIComponent(pendingArtifactHubUrl)}`;
          } else if (pendingPrompt) {
            sessionStorage.removeItem('pendingPrompt');
            window.location.href = `/workspace/new?prompt=${encodeURIComponent(pendingPrompt)}`;
          } else {
            window.location.href = '/';
          }
        }
      };

      window.addEventListener('message', messageHandler);
    } catch (error) {
      logger.error("Failed to initiate Google login", { error });
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
