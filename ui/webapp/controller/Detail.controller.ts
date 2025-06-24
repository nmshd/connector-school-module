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
            detailStudent: {}
        });
        this.setModel(viewModel, "detailView");

        this.getRouter()
            .getRoute("detail")
            .attachPatternMatched(
                (event: Route$MatchedEvent) => void this.onObjectMatched(event),
                this
            );
    }

    private async onObjectMatched(event: Route$MatchedEvent) {
        const viewModel = this.getModel("detailView");

        viewModel.setProperty("/busy", true);
        this.id =
            (event.getParameter("arguments") as inputParameters).id ||
            this.id ||
            "0";

        const student = await axios.get<{ result: Student }>(
            "/students/" + this.id,
            {
                headers: {
                    "X-API-KEY": this.getOwnerComponent().getApiKey()
                }
            }
        );

        viewModel.setProperty("/detailStudent", student.data.result);

        viewModel.setProperty("/busy", false);
    }

    private onBindingChange() {
        const elementBinding = this.getView().getElementBinding();
        // No data for the binding
        if (!elementBinding.getBoundContext()) {
            void this.getRouter().getTargets().display("detailObjectNotFound");
        }
    }

    public onCloseDetailPress(): void {
        this.getModel("appView").setProperty(
            "/actionButtonsInfo/midColumn/fullScreen",
            false
        );
        this.getRouter().navTo("master");
    }

    public handleFullScreen(): void {
        const nextLayout = this.getModel("appView").getProperty(
            "/actionButtonsInfo/midColumn/fullScreen"
        ) as string;
        this.getRouter().navTo("detail", { layout: nextLayout, id: this.id });
    }

    public handleExitFullScreen(): void {
        const nextLayout = this.getModel("appView").getProperty(
            "/actionButtonsInfo/midColumn/exitFullScreen"
        ) as string;
        this.getRouter().navTo("detail", { layout: nextLayout, id: this.id });
    }

    public handleClose(): void {
        const nextLayout = this.getModel("appView").getProperty(
            "/actionButtonsInfo/midColumn/closeColumn"
        ) as string;
        this.getRouter().navTo("master", { layout: nextLayout });
    }
}
