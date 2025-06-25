import axios from "axios";
import { LayoutType } from "sap/f/library";
import Input from "sap/m/Input";
import { FileUploader$ChangeEvent } from "sap/ui/unified/FileUploader";
import { Student } from "../../../src/types";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class Login extends BaseController {
    private configFile: any;

    async onLogin() {
        const apiInput = this.byId("apiKeyInput") as Input;
        const reader = new FileReader();

        reader.onload = (event) => {
            const config = JSON.parse(event.target.result);
            config.pdfDefaults.place_date = config.pdfDefaults.place_date + ", " + new Date().toLocaleDateString();
            config.this.getModel("config").setProperty("/", config);
        };

        reader.readAsText(this.configFile);

        const students = await axios
            .get<{ result: Student[] }>("/students", {
                headers: {
                    "X-API-KEY": apiInput.getValue()
                }
            })
            .catch((err) => {
                console.error("fehler beim login");
            });
        if (students && this.configFile) {
            this.getModel("apiKey").setProperty("/key", apiInput.getValue());
            this.getRouter().navTo("master", { layout: LayoutType.OneColumn });
        }
        console.log(students);
    }

    public onConfigFileChanged(event: FileUploader$ChangeEvent) {
        this.configFile = event.getParameter("files")[0];
    }
}
