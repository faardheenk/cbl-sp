// pnpjsConfig.ts
import { spfi, SPFI } from "@pnp/sp";
import { SPFx } from "@pnp/sp/presets/all";
import { WebPartContext } from "@microsoft/sp-webpart-base";

let _sp: SPFI;

export const resetSP = (): void => {
  _sp = undefined as any;
  console.log("SharePoint context reset");
};

export const getSP = (context: WebPartContext): SPFI => {
  if (!context) {
    throw new Error("WebPartContext is required to initialize SharePoint");
  }

  if (!_sp) {
    _sp = spfi().using(SPFx(context));
  }
  return _sp;
};
