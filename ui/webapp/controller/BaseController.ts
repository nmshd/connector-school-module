import axios from "axios";
import * as saveAs from "file-saver";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import { Button$PressEvent } from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
import Controller from "sap/ui/core/mvc/Controller";
import History from "sap/ui/core/routing/History";
import Router from "sap/ui/core/routing/Router";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import Model from "sap/ui/model/Model";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import { FileUploader$ChangeEvent } from "sap/ui/unified/FileUploader";
import AppComponent from "../Component";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default abstract class BaseController extends Controller {
    private studentZeugnisDialog: Dialog;
    private zeugnisFile: File;
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
    public getModel(name: "app"): JSONModel;
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

    public onZeugnisFileChanged(event: FileUploader$ChangeEvent) {
        this.zeugnisFile = event.getParameter("files")[0] as File;
    }

    public async onDownloadPdf(event: Button$PressEvent, modelName: string): Promise<void> {
        const studentId = event.getSource().getBindingContext(modelName).getProperty("id") as number;
        const vorname = event.getSource().getBindingContext(modelName).getProperty("givenname") as number;
        const nachname = event.getSource().getBindingContext(modelName).getProperty("surname") as number;
        const response = await axios.post<Blob>(
            `/students/${studentId}/onboarding`,
            {
                fields: this.getModel("config").getObject("/pdfDefaults/fields"),
                logo: this.getModel("config").getObject("/pdfDefaults/logo")
            },
            {
                headers: {
                    "X-API-KEY": this.getOwnerComponent().getApiKey(),
                    Accept: "application/pdf"
                },
                responseType: "blob"
            }
        );

        saveAs(response.data, `${studentId}_${nachname}_${vorname}_Onboarding.pdf`);
    }

    public async onSendZeugnis(event: Button$PressEvent, modelName: string): Promise<void> {
        this.studentZeugnisDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.UploadZeugnis"
        })) as Dialog;
        this.studentZeugnisDialog.open();
        this.studentZeugnisDialog.setModel(
            new JSONModel({
                id: event.getSource().getBindingContext(modelName).getProperty("id")
            }),
            "studentModel"
        );
    }

    public onCloseZeugnisDialog() {
        this.studentZeugnisDialog.close();
    }
    public onZeugnisUpload() {
        this.studentZeugnisDialog.setBusy(true);
        const reader = new FileReader();
        const studentId = this.studentZeugnisDialog.getModel("studentModel").getProperty("/id") as number;
        reader.onload = async (event) => {
            const dataUrl = event.target.result as string;
            const base64 = dataUrl.split(",")[1];
            try {
                await axios.post(
                    `/students/${studentId}/files/abiturzeugnis`,
                    {
                        file: base64,
                        filename: this.zeugnisFile.name,
                        ...this.getModel("config").getProperty("/sendDefaults")
                    },
                    {
                        headers: {
                            "X-API-KEY": this.getOwnerComponent().getApiKey()
                        }
                    }
                );
            } catch (e: unknown) {
                if (axios.isAxiosError(e)) {
                    MessageBox.error("Fehler beim Hochladen des Zeugnisses.", {
                        details: JSON.stringify(e.response.data)
                    });
                }
            } finally {
                this.studentZeugnisDialog.setBusy(false);
                this.studentZeugnisDialog.close();
                await this.onRefresh();
            }
        };

        reader.readAsDataURL(this.zeugnisFile);
    }

    abstract onRefresh(): Promise<void>;
}
