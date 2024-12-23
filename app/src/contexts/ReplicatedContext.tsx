import React, { createContext, useContext, useState, useEffect } from 'react';

interface ReplicatedContextType {
  isAuthenticated: boolean;
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const ReplicatedContext = createContext<ReplicatedContextType | undefined>(undefined);

export function ReplicatedProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem('replicatedToken');
  });

  const setToken = (newToken: string) => {
    localStorage.setItem('replicatedToken', newToken);
    setTokenState(newToken);
  };

  const clearToken = () => {
    localStorage.removeItem('replicatedToken');
    setTokenState(null);
  };

  return (
    <ReplicatedContext.Provider value={{
      isAuthenticated: !!token,
      token,
      setToken,
      clearToken,
    }}>
      {children}
    </ReplicatedContext.Provider>
  );
}

export function useReplicated() {
  const context = useContext(ReplicatedContext);
  if (context === undefined) {
    throw new Error('useReplicated must be used within a ReplicatedProvider');
  }
  return context;
}