import axios from "axios";
import { saveAs } from "file-saver";
import { Button$PressEvent } from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
import DateFormat from "sap/ui/core/format/DateFormat";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONListBinding from "sap/ui/model/json/JSONListBinding";
import JSONModel from "sap/ui/model/json/JSONModel";
import Table, { Table$RowSelectionChangeEvent } from "sap/ui/table/Table";
import { FileUploader$ChangeEvent } from "sap/ui/unified/FileUploader";
import { StudentDTO } from "../../../src/types";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class Master extends BaseController {
    private addStudentsDialog: Dialog;
    private studentLogDialog: Dialog;
    private studentQRDialog: Dialog;
    private csvFile: Blob;

    private _oGlobalFilter: Filter;

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
        this.setModel(
            new JSONModel({
                selectedItemCount: 0,
                globalFilter: ""
            }),
            "ui"
        );
    }

    public onRowSelectionChange(event: Table$RowSelectionChangeEvent) {
        const table = this.byId("table") as Table;
        const selectedItems = table.getSelectedIndices();
        this.getModel("ui").setProperty("/selectedItemCount", selectedItems.length);
    }

    public onCSVFileChanged(event: FileUploader$ChangeEvent) {
        this.csvFile = event.getParameter("files")[0] as Blob;
    }

    public async onDownloadCSV() {
        const response = await axios.get(`/students`, {
            headers: {
                "X-API-KEY": this.getOwnerComponent().getApiKey(),
                Accept: "text/csv"
            }
        });
        const date = DateFormat.getDateInstance({
            pattern: "yyMMdd_HHmmss_"
        }).format(new Date());
        saveAs(new Blob(["\uFEFF" + response.data], { type: "text/csv; charset=utf-8" }), date + "Schülerliste.csv");
    }

    public async onDownloadXLSX() {
        const response = await axios.get(`/students`, {
            headers: {
                "X-API-KEY": this.getOwnerComponent().getApiKey(),
                Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            },
            responseType: "blob"
        });
        const date = DateFormat.getDateInstance({
            pattern: "yyMMdd_HHmmss_"
        }).format(new Date());
        saveAs(response.data, date + "Schülerliste.xlsx");
    }

    public async onOpenAddStudentsDialog(): Promise<void> {
        this.addStudentsDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.AddStudentsDialog"
        })) as Dialog;
        this.addStudentsDialog.open();
    }

    public onCloseAddStudentsDialog(): void {
        (this.byId("addStudentsDialog") as Dialog)?.close();
    }

    public async onOpenStudentLogDialog(): Promise<void> {
        this.studentLogDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.StudentLogDialog"
        })) as Dialog;
        this.studentLogDialog.open();
    }

    public onCloseStudentLogDialog(): void {
        (this.byId("studentLogDialog") as Dialog)?.close();
        this.getModel("appView").setProperty("/logOutput", "");
    }

    public async onOpenStudentQRDialog(): Promise<void> {
        this.studentQRDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.StudentQRDialog"
        })) as Dialog;
        this.studentQRDialog.open();
    }

    public onCloseStudentQRDialog(): void {
        (this.byId("studentQRDialog") as Dialog)?.close();
        this.getModel("appView").setProperty("/studentQR", "");
        this.getModel("appView").setProperty("/studentLink", "");
        this.getModel("appView").setProperty("/student", {});
    }

    public searchTable(oEvent: any): void {
        const sQuery = oEvent.getParameter("query");
        this._oGlobalFilter = null;

        if (sQuery) {
            this._oGlobalFilter = new Filter(
                [
                    new Filter("id", FilterOperator.Contains, sQuery),
                    new Filter("surname", FilterOperator.Contains, sQuery),
                    new Filter("givenname", FilterOperator.Contains, sQuery),
                    new Filter("pin", FilterOperator.Contains, sQuery)
                ],
                false
            );
        }

        const table = this.byId("table") as Table;
        (table.getBinding() as JSONListBinding).filter(this._oGlobalFilter, "Application");
    }

    public onUploadFiles() {
        this.addStudentsDialog.setBusy(true);
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
                const date = DateFormat.getDateInstance({
                    pattern: "yyMMdd_HHmmss_"
                }).format(new Date());
                saveAs(new Blob(["\uFEFF" + response.data.result], { type: "text/csv; charset=utf-8" }), date + "ImportierteSchülerMitPIN.csv");
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    this.addStudentsDialog.setBusy(false);
                    MessageBox.error("An error occurred while uploading the students.", {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        details: error.response.data.error.message || "Unknown error"
                    });
                    return;
                }
            }
            await this.loadStudents();
            this.addStudentsDialog.setBusy(false);
            this.addStudentsDialog.close();
        };
        reader.readAsText(this.csvFile);
    }

    public async onStudentLog(event: Button$PressEvent): Promise<void> {
        const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
        const response = await axios.get(`/students/${studentId}/log`, {
            headers: {
                "X-API-KEY": this.getOwnerComponent().getApiKey(),
                Accept: "text/plain"
            }
        });
        this.onOpenStudentLogDialog();
        this.getModel("appView").setProperty("/logOutput", response.data);
    }

    public async onStudentQR(event: Button$PressEvent): Promise<void> {
        const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
        const response = await axios.get(`/students/${studentId}/onboarding`, {
            headers: {
                "X-API-KEY": this.getOwnerComponent().getApiKey(),
                Accept: "application/json"
            }
        });
        const studentObject: any = event.getSource().getBindingContext("studentModel").getObject();
        this.getModel("appView").setProperty("/student", studentObject);
        this.getModel("appView").setProperty("/studentLink", response.data.result.link);
        this.getModel("appView").setProperty("/studentQR", "data:image/png;base64," + response.data.result.png);
        this.onOpenStudentQRDialog();
    }

    public onDeleteSelectedStudents(event: Button$PressEvent): void {
        const selectedItemCount = this.getModel("ui").getProperty("/selectedItemCount");
        let message = `Bitte bestätigen Sie die Löschung von ${selectedItemCount} Schülern.`;
        if (selectedItemCount === 1) {
            message = `Bitte bestätigen Sie die Löschung von einem Schüler.`;
        }
        MessageBox.confirm(message, {
            onClose: async (action: string) => {
                if (action === "OK") {
                    const table = this.byId("table") as Table;
                    const selectedIndices = table.getSelectedIndices();
                    const items = table.getRows();
                    for (const selectedIndex of selectedIndices) {
                        const item = items[selectedIndex];
                        if (!item) continue;
                        const studentId = item.getBindingContext("studentModel").getProperty("id");
                        await this.deleteStudent(studentId, false);
                    }
                    this.loadStudents();
                }
            }
        });
    }

    public onDeleteStudent(event: Button$PressEvent): void {
        MessageBox.confirm("Möchten Sie den Schüler wirklich löschen?", {
            onClose: (action: string) => {
                if (action === "OK") {
                    const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
                    this.deleteStudent(studentId);
                }
            }
        });
    }

    public async onRefresh(): Promise<void> {
        await this.loadStudents();
    }

    public async onDownloadPdf(event: Button$PressEvent): Promise<void> {
        const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
        const vorname = event.getSource().getBindingContext("studentModel").getProperty("givenname") as number;
        const nachname = event.getSource().getBindingContext("studentModel").getProperty("surname") as number;
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

    private async deleteStudent(studentId: number, reload: boolean = true): Promise<void> {
        return new Promise((resolve, reject) => {
            axios
                .delete(`/students/${studentId}`, {
                    headers: {
                        "X-API-KEY": this.getOwnerComponent().getApiKey()
                    }
                })
                .then(() => {
                    if (reload) this.loadStudents();
                    resolve();
                })
                .catch((error) => {
                    console.error("Error deleting student:", error);
                    reject(error);
                });
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
        const table = this.byId("table") as Table;
        const selectedIndices = table.getSelectedIndices();
        const items = table.getRows();
        const selectedStudentIds = [];
        for (const selectedIndex of selectedIndices) {
            const item = items[selectedIndex];
            if (!item) continue;
            const studentId = item.getBindingContext("studentModel").getProperty("id");
            selectedStudentIds.push(studentId);
        }

        const response = await axios.post<Blob>(
            "/students/onboarding",
            {
                fields: this.getModel("config").getObject("/pdfDefaults/fields"),
                logo: this.getModel("config").getObject("/pdfDefaults/logo"),
                students: selectedStudentIds.length > 0 ? selectedStudentIds : undefined
            },
            {
                responseType: "blob",
                headers: {
                    "X-API-KEY": this.getOwnerComponent().getApiKey()
                }
            }
        );

        const date = DateFormat.getDateInstance({
            pattern: "yyMMdd_HHmmss_"
        }).format(new Date());
        saveAs(response.data, date + "Gesammelte_Onboarding_Dokumente.pdf");
    }

    public formatStatus(value: string): string {
        switch (value) {
            case "onboarding":
                return "Warten auf Schüler";
            case "deleted":
                return "Schüler hat sich gelöscht";
            case "rejected":
                return "Schüler hat Einwilligung abgelehnt";
            case "active":
                return "Aktiv";
        }
    }
}
