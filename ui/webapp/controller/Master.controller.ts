import axios from "axios";
import { saveAs } from "file-saver";
import { Button$PressEvent } from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
import Page from "sap/m/Page";
import DateFormat from "sap/ui/core/format/DateFormat";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONListBinding from "sap/ui/model/json/JSONListBinding";
import JSONModel from "sap/ui/model/json/JSONModel";
import ListBinding from "sap/ui/model/ListBinding";
import Table from "sap/ui/table/Table";
import FileUploader, { FileUploader$ChangeEvent } from "sap/ui/unified/FileUploader";
import { StudentDTO } from "../../../src/types";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class Master extends BaseController {
    private addStudentsDialog: Dialog;
    private addStudentDialog: Dialog;
    private studentLogDialog: Dialog;
    private studentZeugnisDialog: Dialog;
    private studentQRDialog: Dialog;
    private csvFile: Blob;
    private zeugnisFile: Blob;

    private page: Page;

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
        this.page = this.byId("masterPage") as Page;
        await this.loadStudents();
        this.setModel(
            new JSONModel({
                selectedItemCount: 0,
                globalFilter: ""
            }),
            "ui"
        );
    }

    public onRowSelectionChange() {
        const table = this.byId("table") as Table;
        const selectedItems = table.getSelectedIndices();
        this.getModel("ui").setProperty("/selectedItemCount", selectedItems.length);
    }

    public onCSVFileChanged(event: FileUploader$ChangeEvent) {
        this.csvFile = event.getParameter("files")[0] as Blob;
    }

    public onZeugnisFileChanged(event: FileUploader$ChangeEvent) {
        this.zeugnisFile = event.getParameter("files")[0] as Blob;
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

    // add one student
    public async onAddStudent(): Promise<void> {
        const addStudentModel = this.addStudentDialog.getModel("addStudentModel") as JSONModel;
        const studentData = addStudentModel.getData();
        if (!studentData.surname || !studentData.givenname || !studentData.id || !studentData.emailPrivate || !studentData.emailSchool) {
            MessageBox.error("Bitte füllen Sie alle Pflichtfelder aus.");
            return;
        }
        try {
            await axios.post("/students", studentData, {
                headers: {
                    "X-API-KEY": this.getOwnerComponent().getApiKey()
                }
            });
            await this.loadStudents();
            this.onCloseAddStudentDialog();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                MessageBox.error("Fehler beim Hinzufügen des Schülers.", {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    details: error.response.data.error.message || "Unbekannter Fehler"
                });
            }
        }
    }

    // Import students from CSV file
    public async onOpenAddStudentsDialog(): Promise<void> {
        this.addStudentsDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.AddStudentsDialog"
        })) as Dialog;
        this.addStudentsDialog.open();
        (this.byId("csvFileUploader") as FileUploader)?.setValue("");
        this.csvFile = null;
    }
    // add one student manually via dialog
    public async onOpenAddStudentDialog(): Promise<void> {
        const addStudentModel = new JSONModel();
        this.addStudentDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.AddStudentDialog"
        })) as Dialog;
        this.addStudentDialog.setModel(addStudentModel, "addStudentModel");
        this.addStudentDialog.open();
    }

    public onCloseAddStudentDialog(): void {
        (this.addStudentDialog.getModel("addStudentModel") as JSONModel).setData({});
        (this.byId("addStudentDialog") as Dialog)?.close();
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

    private readFileAsText(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve("" + event.target.result);
            };
            reader.onerror = (event) => {
                reject(event);
            };
            reader.readAsText(blob);
        });
    }

    public async onUploadFiles() {
        if (!this.csvFile) return;
        this.addStudentsDialog.setBusy(true);
        try {
            const csv = await this.readFileAsText(this.csvFile);
            const response = await axios.post<{ result: string }>(
                "/students/create/batch",
                {
                    students: csv,
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
            await this.loadStudents();
        } catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                MessageBox.error("Während des Imports ist ein Fehler passiert.", {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    details: error.response.data.error.message || "Unknown error"
                });
                return;
            }
        } finally {
            this.addStudentsDialog.setBusy(false);
            this.addStudentsDialog.close();
        }
    }

    public async onStudentLog(event: Button$PressEvent): Promise<void> {
        const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
        const response = await axios.get(`/students/${studentId}/log`, {
            headers: {
                "X-API-KEY": this.getOwnerComponent().getApiKey(),
                Accept: "text/plain"
            }
        });
        await this.onOpenStudentLogDialog();
        this.getModel("appView").setProperty("/logOutput", response.data);
    }

    public async onSendZeugnis(event: Button$PressEvent): Promise<void> {
        this.studentZeugnisDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.UploadZeugnis"
        })) as Dialog;
        this.studentZeugnisDialog.open();
        this.getView().addDependent(this.studentZeugnisDialog);
        this.studentZeugnisDialog.setBindingContext(event.getSource().getBindingContext("studentModel"), "studentModel");
    }

    public onCloseZeugnisDialog() {
        this.studentZeugnisDialog.close();
        this.studentZeugnisDialog.setBindingContext(null, "studentModel");
    }
    public onZeugnisUpload() {
        this.studentZeugnisDialog.setBusy(true);
        const reader = new FileReader();
        const studentId = this.studentZeugnisDialog.getBindingContext("studentModel").getProperty("id") as number;
        reader.onload = async (event) => {
            const dataUrl = event.target.result as string;

            const base64 = dataUrl.split(",")[1];
            try {
                await axios.post(
                    `/students/${studentId}/files/abiturzeugnis`,
                    {
                        file: base64
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
        };

        reader.readAsDataURL(this.zeugnisFile);

        this.studentZeugnisDialog.close();
        this.studentZeugnisDialog.setBindingContext(null, "studentModel");
    }

    public async onStudentQR(event: Button$PressEvent): Promise<void> {
        const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
        const response = await axios.get(`/students/${studentId}/onboarding`, {
            headers: {
                "X-API-KEY": this.getOwnerComponent().getApiKey(),
                Accept: "application/json"
            }
        });
        const studentObject = event.getSource().getBindingContext("studentModel").getObject();
        this.getModel("appView").setProperty("/student", studentObject);
        this.getModel("appView").setProperty("/studentLink", response.data.result.link);
        this.getModel("appView").setProperty("/studentQR", "data:image/png;base64," + response.data.result.png);
        await this.onOpenStudentQRDialog();
    }

    public onDeleteSelectedStudents(): void {
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

                    const items = (table.getBinding() as ListBinding).getAllCurrentContexts();
                    for (const selectedIndex of selectedIndices) {
                        const item = items[selectedIndex];
                        if (!item) continue;
                        const studentId = item.getProperty("id");
                        await this.deleteStudent(studentId, false);
                    }
                    await this.loadStudents();
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
                .then(async () => {
                    if (reload) await this.loadStudents();
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
        const selectedStudentIds = [];

        this.page.setBusy(true);
        try {
            const items = (table.getBinding() as ListBinding).getAllCurrentContexts();
            for (const selectedIndex of selectedIndices) {
                const item = items[selectedIndex];
                if (!item) continue;
                const studentId = item.getProperty("id");
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
        } catch (e) {
            console.error(e);
        } finally {
            this.page.setBusy(false);
        }
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
