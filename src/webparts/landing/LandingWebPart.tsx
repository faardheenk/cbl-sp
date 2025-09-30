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
  public async render(): Promise<void> {
    const sp = getSP(this.context);

    // Load Poppins font and wait for it to load
    await this.loadPoppinsFont();

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

  private loadPoppinsFont(): Promise<void> {
    return new Promise((resolve) => {
      // Check if Poppins font link already exists
      const existingLink = document.querySelector(
        'link[href*="fonts.googleapis.com"][href*="Poppins"]'
      );

      if (existingLink) {
        resolve();
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap";

      link.onload = () => resolve();
      link.onerror = () => resolve(); // Continue even if font fails to load

      document.head.appendChild(link);
    });
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse("1.0");
  }
}
