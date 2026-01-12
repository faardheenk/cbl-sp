import * as React from "react";
import * as ReactDom from "react-dom";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import { SpContext } from "../../SpContext";
import Reconciliation from "./components/Reconciliation";
import { Version } from "@microsoft/sp-core-library";
import { getSP, resetSP } from "../../pnpjsConfig";
import { TaskProvider } from "../../context/TaskContext";
import { ChangesProvider } from "../../context/ChangesContext";
import { ReconciliationProvider } from "../../context/ReconciliationContext";

export default class ReconciliationWebPart extends BaseClientSideWebPart<{}> {
  public render(): void {
    const sp = getSP(this.context);

    // Load Poppins font
    this.loadPoppinsFont();

    const element: React.ReactElement = (
      <SpContext.Provider value={{ context: this.context, sp }}>
        <TaskProvider context={this.context}>
          <ChangesProvider>
            <ReconciliationProvider>
              <Reconciliation />
            </ReconciliationProvider>
          </ChangesProvider>
        </TaskProvider>
      </SpContext.Provider>
    );

    ReactDom.render(element, this.domElement);
  }

  private loadPoppinsFont(): void {
    // Check if Poppins font link already exists
    const existingLink = document.querySelector(
      'link[href*="fonts.googleapis.com"][href*="Poppins"]'
    );

    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap";
      document.head.appendChild(link);
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
    resetSP(); // Reset SharePoint context when disposing
  }

  protected get dataVersion(): Version {
    return Version.parse("1.0");
  }
}
