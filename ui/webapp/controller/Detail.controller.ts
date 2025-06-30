import axios from "axios";
import { Route$MatchedEvent } from "sap/ui/core/routing/Route";
import JSONModel from "sap/ui/model/json/JSONModel";
import { Student } from "../../../src/types";
import formatter from "../model/formatter";
import { inputParameters } from "./App.controller";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class Detail extends BaseController {
    private id: string;
    private formatter = formatter;

    public onInit(): void {
        const viewModel = new JSONModel({
            busy: false,
            delay: 0,
            student: {}
        });
        this.setModel(viewModel, "detailView");

        this.getRouter()
            .getRoute("detail")
            .attachPatternMatched((event: Route$MatchedEvent) => void this.onObjectMatched(event), this);
    }

    public async onRefresh() {
        await this.onObjectMatched();
    }

    private async onObjectMatched(event?: Route$MatchedEvent) {
        const viewModel = this.getModel("detailView");

        viewModel.setProperty("/busy", true);
        this.id = (event?.getParameter("arguments") as inputParameters)?.id || this.id || "0";

        const apiKey = this.getOwnerComponent().getApiKey();
        if (!apiKey) {
            return;
        }
        const student = await axios.get<{ result: Student }>("/students/" + this.id, {
            headers: {
                "X-API-KEY": apiKey
            }
        });

        viewModel.setProperty("/detailStudent", student.data.result);

        const response = await axios.get(`/students/${this.id}/onboarding`, {
            headers: {
                "X-API-KEY": apiKey,
                Accept: "application/json"
            }
        });
        viewModel.setProperty("/studentLink", response.data.result.link);
        viewModel.setProperty("/studentQR", "data:image/png;base64," + response.data.result.png);

        const logResponse = await axios.get(`/students/${this.id}/log`, {
            headers: {
                "X-API-KEY": apiKey,
                Accept: "text/plain"
            }
        });
        viewModel.setProperty("/logOutput", logResponse.data);
        const filesResponse = await axios.get(`/students/${this.id}/files`, {
            headers: {
                "X-API-KEY": apiKey
            }
        });
        viewModel.setProperty("/files", filesResponse.data.result);

        viewModel.setProperty("/busy", false);
    }

    public handleClose(): void {
        const nextLayout = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/closeColumn") as string;
        this.getRouter().navTo("master", { layout: nextLayout });
    }
}
