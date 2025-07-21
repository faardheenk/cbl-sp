import * as React from "react";
import * as ReactDom from "react-dom";
import { Version } from "@microsoft/sp-core-library";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import Landing from "./components/Landing";
import { SpContext } from "../../SpContext";
import { TaskProvider } from "../../context/TaskContext";
import { getSP } from "../../pnpjsConfig";
import { ReconciliationProvider } from "../../context/ReconciliationContext";

export interface ILandingWebPartProps {
  description: string;
}

export default class LandingWebPart extends BaseClientSideWebPart<{}> {
  public render(): void {
    const sp = getSP(this.context);

    const element: React.ReactElement = (
      <SpContext.Provider value={{ context: this.context, sp }}>
        <TaskProvider context={this.context}>
          <ReconciliationProvider>
            <Landing />
          </ReconciliationProvider>
        </TaskProvider>
      </SpContext.Provider>
      // <Reconciliation />
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
