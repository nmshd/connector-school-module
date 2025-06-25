import axios from "axios";
import { saveAs } from "file-saver";
import { Button$PressEventParameters } from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
import { FileUploader$ChangeEvent } from "sap/ui/unified/FileUploader";
import { StudentDTO } from "../../../src/types";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class Master extends BaseController {
    private dialog: Dialog;
    private csvFile: Blob;
    public onInit(): void {
        this.getRouter()
            .getRoute("master")
            .attachPatternMatched(() => void this.onObjectMatched(), this);
    }

    public logout(): void {
        window.sessionStorage.clear();
        this.getRouter().navTo("login");
    }

    private async onObjectMatched() {
        await this.loadStudents();
    }

    public onCSVFileChanged(event: FileUploader$ChangeEvent) {
        this.csvFile = event.getParameter("files")[0] as Blob;
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

    public onUploadFiles() {
        this.dialog.setBusy(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const response = await axios.post<{ result: string }>(
                    "/students/create/batch",
                    {
                        students: event.target.result,
                        options: this.getModel("config").getData() as unknown
                    },
                    {
                        headers: {
                            "X-API-KEY": this.getOwnerComponent().getApiKey()
                        }
                    }
                );
                saveAs(new Blob([response.data.result]), "test.csv");
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    this.dialog.setBusy(false);
                    MessageBox.error("An error occurred while uploading the students.", {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        details: error.response.data.error.message || "Unknown error"
                    });
                    return;
                }
            }
            await this.loadStudents();
            this.dialog.setBusy(false);
            this.dialog.close();
        };
        reader.readAsText(this.csvFile);
    }

    public onDeleteStudent(event: Button$PressEventParameters): void {
        MessageBox.confirm("Are you sure you want to delete this student?", {
            onClose: (action: string) => {
                if (action === "OK") {
                    const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
                    this.deleteStudent(studentId);
                }
            }
        });
    }

    public async onDownloadPdf(event: Button$PressEventParameters): Promise<void> {
        const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
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

        saveAs(response.data, `student_${studentId}_onboarding.pdf`);
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

    public async downloadStudents() {
        const response = await axios.post<Blob>(
            "/students/onboarding",
            {
                fields: this.getModel("config").getObject("/pdfDefaults/fields"),
                logo: this.getModel("config").getObject("/pdfDefaults/logo")
            },
            {
                responseType: "blob",
                headers: {
                    "X-API-KEY": this.getOwnerComponent().getApiKey()
                }
            }
        );

        saveAs(response.data, "combined-onboarding.pdf");
    }

    public formatStatus(value: string): string {
        switch (value) {
            case "onboarding":
                return "Warten auf Einwilligung";
            case "deleted":
                return "Schüler hat sich gelöscht";
            case "active":
                return "Aktiv";
        }
    }
}
