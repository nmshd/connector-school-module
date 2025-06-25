import axios from "axios";
import { Button$PressEventParameters } from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
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

    public onDeleteStudent(event: Button$PressEventParameters): void {
        MessageBox.confirm("Are you sure you want to delete this student?", {
            onClose: (action) => {
                if (action === "OK") {
                    const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
                    this.deleteStudent(studentId);
                }
            }
        });
    }

    private deleteStudent(studentId: number): void {
        axios
            .delete(`/students/${studentId}`, {
                headers: {
                    "X-API-KEY": this.getOwnerComponent().getApiKey()
                }
            })
            .then(() => this.loadStudents())
            .catch((error) => {
                console.error("Error deleting student:", error);
            });
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
