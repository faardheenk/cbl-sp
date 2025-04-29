import * as React from "react";
import * as ReactDom from "react-dom";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import { SpContext } from "../../SpContext";
import Reconciliation from "./components/Reconciliation";
import { Version } from "@microsoft/sp-core-library";
import { getSP } from "../../pnpjsConfig";

export default class ReconciliationWebPart extends BaseClientSideWebPart<{}> {
  public render(): void {
    const sp = getSP(this.context);

    const element: React.ReactElement = (
      <SpContext.Provider value={{ context: this.context, sp }}>
        <Reconciliation />
      </SpContext.Provider>
    );

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse("1.0");
  }
}
