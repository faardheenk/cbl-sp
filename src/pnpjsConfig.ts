// pnpjsConfig.ts
import { spfi, SPFI } from "@pnp/sp";
import { SPFx } from "@pnp/sp/presets/all";
import { WebPartContext } from "@microsoft/sp-webpart-base";

let _sp: SPFI;

export const getSP = (context: WebPartContext): SPFI => {
  if (!_sp) {
    _sp = spfi().using(SPFx(context));
  }
  return _sp;
};
