import React, { createContext, useContext, useState, ReactNode } from "react";

interface ChangesContextType {
  changes: boolean;
  setChanges: (changes: boolean) => void;
}

const ChangesContext = createContext<ChangesContextType | undefined>(undefined);

export const ChangesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [changes, setChanges] = useState<boolean>(false);

  return (
    <ChangesContext.Provider value={{ changes, setChanges }}>
      {children}
    </ChangesContext.Provider>
  );
};

export const useChanges = (): ChangesContextType => {
  const context = useContext(ChangesContext);
  if (context === undefined) {
    throw new Error("useChanges must be used within a ChangesProvider");
  }
  return context;
};
