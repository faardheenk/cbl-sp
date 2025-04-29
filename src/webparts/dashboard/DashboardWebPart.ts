import * as React from "react";
import * as ReactDom from "react-dom";

import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";

import Dashboard from "./components/Dashboard";

export default class DashboardWebPart extends BaseClientSideWebPart<{}> {
  public render(): void {
    const element: React.ReactElement<{}> = React.createElement(Dashboard);

    ReactDom.render(element, this.domElement);
  }
}
