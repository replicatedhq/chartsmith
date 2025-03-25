"use client";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { UserMenu } from "./UserMenu";
import { getGoogleAuthUrl } from "@/lib/auth/google";
import { useToast } from "./toast/use-toast";
import { logger } from "@/lib/utils/logger";

export function AuthButtons() {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();

  const handleLogin = () => {
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
          
          // Check if the user is waitlisted based on the JWT
          const token = event.data.jwt;
          const payload = token.split('.')[1];
          let isWaitlisted = false;
          
          try {
            if (payload) {
              const decoded = JSON.parse(atob(payload));
              isWaitlisted = decoded.isWaitlisted === true;
            }
          } catch (err) {
            logger.error("Failed to decode JWT payload", { error: err });
          }
          
          if (isWaitlisted) {
            // If user is waitlisted, always redirect to waitlist page
            window.location.href = '/waitlist';
          } else if (pendingArtifactHubUrl) {
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

  if (isAuthenticated) {
    return <UserMenu />;
  }

  return (
    <div className="flex items-center gap-4">
      <button onClick={handleLogin} className={`px-4 py-2 rounded-lg transition-colors ${theme === "dark" ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}>
        Log In
      </button>
      <button onClick={handleLogin} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors">
        Get Started
      </button>
    </div>
  );
}
