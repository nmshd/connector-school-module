import { FlexibleColumnLayout$StateChangeEvent } from "sap/f/FlexibleColumnLayout";
import { Router$RouteMatchedEvent } from "sap/ui/core/routing/Router";
import JSONModel from "sap/ui/model/json/JSONModel";
import BaseController from "./BaseController";

export type inputParameters = {
    id: string;
};

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class App extends BaseController {
    private currentRouteName: string;
    private currentId: string;

    public onInit(): void {
        // apply content density mode to root view
        this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
        this.getOwnerComponent()
            .getRouter()
            .attachRouteMatched((event: Router$RouteMatchedEvent) => this.onRouteMatched(event), this);
    }

    public onStateChanged(event: FlexibleColumnLayout$StateChangeEvent): void {
        const isNavigationArrow = event.getParameter("isNavigationArrow"),
            layout = event.getParameter("layout");

        void this.updateUIElements();

        // Replace the URL with the new layout if a navigation arrow was used
        if (isNavigationArrow) {
            this.getOwnerComponent().getRouter().navTo(this.currentRouteName, { layout: layout, id: this.currentId }, {}, true);
        }
    }

    public onRouteMatched(oEvent: Router$RouteMatchedEvent): void {
        const routeName = oEvent.getParameter("name"),
            args = oEvent.getParameter("arguments") as inputParameters;

        void this.updateUIElements();

        // Save the current route name
        this.currentRouteName = routeName;
        this.currentId = args.id;
    }

    private async updateUIElements() {
        const model = this.getOwnerComponent().getModel("appView") as JSONModel,
            helper = await this.getOwnerComponent().getHelper(),
            uiState = helper.getCurrentUIState();

        model.setData(uiState);
    }

    public onExit(): void {
        const router = this.getRouter();
        if (router) {
            this.getRouter().detachRouteMatched((event: Router$RouteMatchedEvent) => this.onRouteMatched(event), this);
        }
    }
}
