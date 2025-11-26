"use client";
import React, { useEffect, useState } from "react";
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
  const [publicEnv, setPublicEnv] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Failed to fetch config");
        const data = await res.json();
        setPublicEnv(data);
      } catch (err) {
        console.error("Failed to load public env config:", err);
      }
    };

    fetchConfig();
  }, []);

  const handleLogin = () => {
    if (!publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      return;
    }

    try {
      const authUrl = getGoogleAuthUrl(publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID, publicEnv.NEXT_PUBLIC_GOOGLE_REDIRECT_URI);

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
    <div className="flex items-center gap-3">
      <button
        onClick={handleLogin}
        className={`
          px-4 py-2 rounded-forge font-medium text-sm transition-all duration-200
          ${theme === "dark"
            ? "text-forge-silver hover:text-stone-100 hover:bg-forge-iron/50"
            : "text-stone-500 hover:text-stone-700 hover:bg-stone-100"
          }
        `}
      >
        Log In
      </button>
      <button
        onClick={handleLogin}
        className="
          group relative px-5 py-2.5 rounded-forge font-display font-semibold text-sm
          bg-forge-ember text-white overflow-hidden
          transition-all duration-300 hover:shadow-ember
          active:scale-[0.98]
        "
      >
        <span className="relative z-10">Get Started</span>
        <div className="absolute inset-0 bg-gradient-to-r from-forge-ember-bright to-forge-ember opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </button>
    </div>
  );
}
