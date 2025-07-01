import axios from "axios";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
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
    private newMessageDialog: Dialog;

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
        try {
            const student = await axios.get<{ result: Student }>("/students/" + this.id, {
                headers: {
                    "X-API-KEY": apiKey
                }
            });

            viewModel.setProperty("/detailStudent", student.data.result);
        } catch (e: unknown) {
            this.getRouter().navTo("master");
            return;
        }

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
        const mailsResponse = await axios.get(`/students/${this.id}/mails`, {
            headers: {
                "X-API-KEY": apiKey
            }
        });
        viewModel.setProperty("/mails", mailsResponse.data.result);

        viewModel.setProperty("/busy", false);
    }

    public handleClose(): void {
        const nextLayout = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/closeColumn") as string;
        this.getRouter().navTo("master", { layout: nextLayout });
    }

    public async openNewMessageDialog(): Promise<void> {
        this.newMessageDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.NewMessageDialog"
        })) as Dialog;
        this.newMessageDialog.open();
        this.newMessageDialog.setModel(
            new JSONModel({
                subject: "",
                body: ""
            }),
            "messageModel"
        );
    }

    public onCloseNewMessageDialog() {
        this.newMessageDialog.close();
    }
    public async onNewMessageSend() {
        this.newMessageDialog.setBusy(true);
        const messageModel = this.newMessageDialog.getModel("messageModel");
        const subject = messageModel.getProperty("/subject") as string;
        const body = messageModel.getProperty("/body") as string;

        try {
            await axios.post(
                `/students/${this.id}/mails`,
                {
                    body,
                    subject
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
        }
        this.newMessageDialog.setBusy(false);
        this.newMessageDialog.close();
        await this.onRefresh();
    }
}
