import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Controller from "sap/ui/core/mvc/Controller";
import History from "sap/ui/core/routing/History";
import Router from "sap/ui/core/routing/Router";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import Model from "sap/ui/model/Model";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import AppComponent from "../Component";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class BaseController extends Controller {
    /**
     * Convenience method for accessing the component of the controller's view.
     * @returns The component of the controller's view
     */
    public getOwnerComponent(): AppComponent {
        return super.getOwnerComponent() as AppComponent;
    }
    /**
     * Convenience method to get the components' router instance.
     * @returns The router instance
     */
    public getRouter(): Router {
        return UIComponent.getRouterFor(this);
    }

    /**
     * Convenience method for getting the view model by name in every controller of the application.
     * @public
     * @param {string} sName the model name
     * @returns {sap.ui.model.Model} the model instance
     */
    public getModel(name: "studentModel"): JSONModel;
    public getModel(name: "detailView"): JSONModel;
    public getModel(name: "appView"): JSONModel;
    public getModel(name: "config"): JSONModel;
    public getModel(name: "ui"): JSONModel;
    public getModel(name: "apiKey"): JSONModel;
    public getModel(name?: string): Model {
        return this.getView().getModel(name);
    }

    /**
     * Convenience method for setting the view model in every controller of the application.
     * @public
     * @param {sap.ui.model.Model} oModel the model instance
     * @param {string} sName the model name
     * @returns {sap.ui.mvc.View} the view instance
     */
    public setModel(model: Model, name?: string): void {
        this.getView().setModel(model, name);
    }

    /**
     * Convenience method for getting the i18n resource bundle of the component.
     * @returns {Promise<sap.base.i18n.ResourceModel>} The i18n resource bundle of the component
     */
    public getResourceBundle(): Promise<ResourceBundle> {
        const oModel = this.getOwnerComponent().getModel("i18n") as ResourceModel;
        return oModel.getResourceBundle() as Promise<ResourceBundle>;
    }

    /**
     * Event handler for navigating back.
     * It there is a history entry we go one step back in the browser history
     * If not, it will replace the current entry of the browser history with the master route.
     * @public
     */
    public onNavBack(): void {
        const sPreviousHash = History.getInstance().getPreviousHash();

        if (sPreviousHash !== undefined) {
            history.go(-1);
        } else {
            this.getRouter().navTo("master", {}, {}, true);
        }
    }
}
