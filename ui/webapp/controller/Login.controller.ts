import axios from "axios";
import { LayoutType } from "sap/f/library";
import Input from "sap/m/Input";
import DateFormat from "sap/ui/core/format/DateFormat";
import { Route$PatternMatchedEvent } from "sap/ui/core/routing/Route";
import { FileUploader$ChangeEvent } from "sap/ui/unified/FileUploader";
import { Student } from "../../../src/types";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class Login extends BaseController {
    private configFile: any;
    private routeAfterLogin: { name: string; arguments: object } | undefined;

    public onInit(): void {
        this.getRouter()
            .getRoute("login")
            .attachPatternMatched((event) => void this.onObjectMatched(event), this);
    }

    private async onObjectMatched(event: Route$PatternMatchedEvent) {
        const args = event.getParameter("arguments");
        try {
            this.routeAfterLogin = JSON.parse(args.afterLoginRoute);
        } catch (error: unknown) {
            this.routeAfterLogin = undefined;
        }
        const apikey = window.sessionStorage.getItem("apikey");
        const config = JSON.parse(window.sessionStorage.getItem("config"));
        if (apikey && config) {
            await this.login(config, apikey);
        }
    }

    private async readFile() {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result.toString());
                    resolve(config);
                } catch (e) {
                    reject({ error: "Fehler in der Config Datei", reason: e });
                }
            };

            reader.readAsText(this.configFile);
        });
    }

    clear() {
        const apiInput = this.byId("apiKeyInput") as Input;
        apiInput.setValue("");
    }

    async login(config: any, apikey: string) {
        const dateString = DateFormat.getDateInstance({
            pattern: "dd.MM.yyyy"
        }).format(new Date());

        if (!config.dateReplaced) {
            config.pdfDefaults.fields.place = config.pdfDefaults.fields.place_date;
            config.pdfDefaults.fields.place_date = `${config.pdfDefaults.fields.place_date}, ${dateString}`;
            config.dateReplaced = true;
        }

        this.getModel("config").setProperty("/", config);

        const students = await axios
            .get<{ result: Student[] }>("/students", {
                headers: {
                    "X-API-KEY": apikey
                }
            })
            .catch((e) => {
                console.error("Fehler beim Login", e);
            });

        const supportInfo = await axios.get("/Monitoring/Support", {
            headers: {
                "X-API-KEY": apikey
            }
        });
        const schoolModuleConfig = supportInfo.data.configuration.modules.school;
        this.getModel("app").setProperty("/schoolModuleConfig", schoolModuleConfig);

        if (students && config) {
            this.getModel("apiKey").setProperty("/key", apikey);
            if (this.routeAfterLogin) {
                this.getRouter().navTo(this.routeAfterLogin.name, this.routeAfterLogin.arguments, false);
            } else {
                this.getRouter().navTo("master", { layout: LayoutType.OneColumn });
            }

            window.sessionStorage.setItem("apikey", apikey);
            window.sessionStorage.setItem("config", JSON.stringify(config));
            this.clear();
        }
        console.log(students);
    }

    async onLogin() {
        const apiInput = this.byId("apiKeyInput") as Input;
        try {
            const config = await this.readFile();
            const apikey = apiInput.getValue();
            await this.login(config, apikey);
        } catch (e) {
            console.error("Fehler beim Login", e);
        }
    }

    public onConfigFileChanged(event: FileUploader$ChangeEvent) {
        this.configFile = event.getParameter("files")[0];
    }
}
