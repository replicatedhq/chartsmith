"use client"

import React, { createContext, useContext, useState } from "react";

import { Scenario } from '@/lib/types/workspace';

interface ValuesScenariosContextType {
  isOpen: boolean;
  toggleScenarios: () => void;
  scenarios: Scenario[];
  addScenario: (scenario: Scenario) => void;
  removeScenario: (id: string) => void;
  activeScenario: Scenario | null;
  setActiveScenario: (scenario: Scenario | null) => void;
}

const ValuesScenariosContext = createContext<ValuesScenariosContextType | undefined>(undefined);

export function ValuesScenariosProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

  const toggleScenarios = () => setIsOpen(!isOpen);

  const addScenario = (scenario: Scenario) => {
    setScenarios([...scenarios, scenario]);
  };

  const removeScenario = (id: string) => {
    setScenarios(scenarios.filter((s) => s.id !== id));
    if (activeScenario?.id === id) {
      setActiveScenario(null);
    }
  };

  return (
    <ValuesScenariosContext.Provider
      value={{
        isOpen,
        toggleScenarios,
        scenarios,
        addScenario,
        removeScenario,
        activeScenario,
        setActiveScenario,
      }}
    >
      {children}
    </ValuesScenariosContext.Provider>
  );
}

export function useValuesScenarios() {
  const context = useContext(ValuesScenariosContext);
  if (context === undefined) {
    throw new Error("useValuesScenarios must be used within a ValuesScenariosProvider");
  }
  return context;
}
