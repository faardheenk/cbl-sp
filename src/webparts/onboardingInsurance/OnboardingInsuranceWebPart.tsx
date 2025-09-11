import * as React from "react";
import * as ReactDom from "react-dom";
import OnboardingInsurance from "./components/OnboardingInsurance";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import { getSP } from "../../pnpjsConfig";
import { SpContext } from "../../SpContext";

export default class OnboardingInsuranceWebPart extends BaseClientSideWebPart<{}> {
  public render(): void {
    const sp = getSP(this.context);
    const element: React.ReactElement = (
      <SpContext.Provider value={{ context: this.context, sp }}>
        <OnboardingInsurance />
      </SpContext.Provider>
    );
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }
}
