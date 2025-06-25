import axios from "axios";
import Dialog from "sap/m/Dialog";
import { Route$MatchedEvent } from "sap/ui/core/routing/Route";
import { FileUploader$ChangeEvent } from "sap/ui/unified/FileUploader";
import { StudentDTO } from "../../../src/types";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class Master extends BaseController {
    private dialog: Dialog;
    private csvFile: string;
    public onInit(): void {
        this.getRouter()
            .getRoute("master")
            .attachPatternMatched((event: Route$MatchedEvent) => void this.onObjectMatched(event), this);
    }

    private async onObjectMatched() {
        // const studentModel = this.getModel("studentModel");

        // const studentsResponse = await axios.get<{ result: StudentDTO[] }>("/students", {
        //     headers: {
        //         "X-API-KEY": this.getOwnerComponent().getApiKey()
        //     }
        // });

        // studentModel.setProperty("/students", studentsResponse.data.result);
        await this.loadStudents();
    }

    public onCSVFileChanged(event: FileUploader$ChangeEvent) {
        this.csvFile = event.getParameter("files")[0];
    }

    public async onOpenAddStudentsDialog(): Promise<void> {
        this.dialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.AddStudentsDialog"
        })) as Dialog;
        this.dialog.open();
    }

    public onCloseAddStudentsDialog(): void {
        (this.byId("addStudentsDialog") as Dialog)?.close();
    }

    public async onUploadFiles() {
        this.dialog.setBusy(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            await axios.post(
                "/students/create/batch",
                {
                    students: event.target.result,
                    options: this.getModel("config").getData()
                },
                {
                    headers: {
                        "X-API-KEY": this.getOwnerComponent().getApiKey()
                    }
                }
            );
            await this.loadStudents();
            this.dialog.setBusy(false);
            this.dialog.close();
        };
        reader.readAsText(this.csvFile);
    }

    private async loadStudents(): Promise<void> {
        const studentModel = this.getModel("studentModel");

        const studentsResponse = await axios.get<{ result: StudentDTO[] }>("/students", {
            headers: {
                "X-API-KEY": this.getOwnerComponent().getApiKey()
            }
        });

        studentModel.setProperty("/students", studentsResponse.data.result);
    }
}
