import React, { useContext } from "react";
import { WebPartContext } from "@microsoft/sp-webpart-base";
import "@pnp/sp/webs";
import "@pnp/sp/files/web";
import { SPFI } from "@pnp/sp";

type SpContextType = {
  context: WebPartContext;
  sp: SPFI;
};

export const SpContext = React.createContext<SpContextType | null>(null);

export const useSpContext = (): SpContextType => {
  const context = useContext(SpContext);
  if (!context) {
    throw new Error("useSpContext must be used within a SpContext.Provider");
  }
  return context;
};
