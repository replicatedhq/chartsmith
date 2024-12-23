import React, { createContext, useContext, useState } from 'react';

interface ValuesScenariosContextType {
  isOpen: boolean;
  toggleScenarios: () => void;
  scenarios: ValuesScenario[];
  addScenario: (scenario: ValuesScenario) => void;
  removeScenario: (id: string) => void;
  activeScenario: ValuesScenario | null;
  setActiveScenario: (scenario: ValuesScenario | null) => void;
}

interface ValuesScenario {
  id: string;
  name: string;
  description: string;
  values: string;
}

const ValuesScenariosContext = createContext<ValuesScenariosContextType | undefined>(undefined);

export function ValuesScenariosProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scenarios, setScenarios] = useState<ValuesScenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<ValuesScenario | null>(null);

  const toggleScenarios = () => setIsOpen(!isOpen);

  const addScenario = (scenario: ValuesScenario) => {
    setScenarios([...scenarios, scenario]);
  };

  const removeScenario = (id: string) => {
    setScenarios(scenarios.filter(s => s.id !== id));
    if (activeScenario?.id === id) {
      setActiveScenario(null);
    }
  };

  return (
    <ValuesScenariosContext.Provider value={{
      isOpen,
      toggleScenarios,
      scenarios,
      addScenario,
      removeScenario,
      activeScenario,
      setActiveScenario,
    }}>
      {children}
    </ValuesScenariosContext.Provider>
  );
}

export function useValuesScenarios() {
  const context = useContext(ValuesScenariosContext);
  if (context === undefined) {
    throw new Error('useValuesScenarios must be used within a ValuesScenariosProvider');
  }
  return context;
}