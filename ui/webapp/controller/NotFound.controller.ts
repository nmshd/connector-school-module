import Target from "sap/ui/core/routing/Target";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class NotFound extends BaseController {
    public onInit(): void {
        (this.getRouter().getTarget("notFound") as Target).attachDisplay(() => this.onNotFoudnDisplayed());
    }
    private onNotFoudnDisplayed() {
        this.getModel("appView").setProperty("/layout", "OneColumn");
    }
}
