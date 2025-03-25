"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  isWaitlisted?: boolean;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isWaitlisted: boolean;
  isAuthLoading: boolean;
  isAdmin: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isWaitlisted, setIsWaitlisted] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check for session cookie
    const cookies = document.cookie.split(";");
    const sessionCookie = cookies.find((c) => c.trim().startsWith("session="));

    if (sessionCookie) {
      const token = sessionCookie.split("=")[1];
      const payload = parseJwt(token);

      if (payload && payload.exp * 1000 > Date.now()) {
        // Valid JWT that hasn't expired
        const waitlisted = payload.isWaitlisted === true;
        const admin = payload.isAdmin === true;
        
        setUser({
          id: payload.sub,
          name: payload.name,
          email: payload.email,
          avatar: payload.picture,
          isWaitlisted: waitlisted,
          isAdmin: admin
        });
        
        setIsWaitlisted(waitlisted);
        setIsAdmin(admin);
        
        // If they're waitlisted and not already on the waitlist page, redirect them
        if (waitlisted && typeof window !== 'undefined' && 
            window.location.pathname !== '/waitlist' && 
            window.location.pathname !== '/login' && 
            window.location.pathname !== '/login-with-test-auth') {
          window.location.href = '/waitlist';
        }
      } else {
        // Invalid or expired token, clear the cookie
        document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
    }
    
    // Authentication check is complete
    setIsAuthLoading(false);
  }, []);

  const signOut = () => {
    setUser(null);
    setIsWaitlisted(false);
    setIsAdmin(false);
    // Delete the session and theme cookies by setting them to expire in the past
    document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
    document.cookie = "theme=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
    // Redirect to home page after logout
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isWaitlisted,
        isAdmin,
        isAuthLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
