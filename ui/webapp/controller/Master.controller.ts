import axios from "axios";
import { saveAs } from "file-saver";
import { Button$PressEvent } from "sap/m/Button";
import CheckBox from "sap/m/CheckBox";
import Dialog from "sap/m/Dialog";
import MessageBox from "sap/m/MessageBox";
import Page from "sap/m/Page";
import Select from "sap/m/Select";
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
    private selectMessageTemplateDialog: Dialog;
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
                globalFilter: "",
                messageTemplates: this.getModel("config").getProperty("/messageTemplates")
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
        try {
            this.page.setBusy(true);
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
        } catch (e) {
            console.error(e);
        } finally {
            this.page.setBusy(false);
        }
    }

    public async onDownloadXLSX() {
        try {
            this.page.setBusy(true);
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
        } catch (e) {
            console.error(e);
        } finally {
            this.page.setBusy(false);
        }
    }

    // add one student
    public async onAddStudent(): Promise<void> {
        const addStudentModel = this.addStudentDialog.getModel("addStudentModel") as JSONModel;
        const studentData = addStudentModel.getData();
        if (!studentData.surname || !studentData.givenname || !studentData.id) {
            MessageBox.error("Bitte füllen Sie alle Pflichtfelder aus.");
            return;
        }

        const generatePin = this.byId("schoolGeneratePin") as CheckBox;
        if (generatePin.getSelected()) {
            studentData.pin = (Math.floor(Math.random() * 10000) + 10000).toString().substring(1);
        }

        const defaultConfig = this.getModel("config").getData();
        if (defaultConfig && defaultConfig.createDefaults && defaultConfig.createDefaults.additionalConsents) {
            studentData.additionalConsents = defaultConfig.createDefaults.additionalConsents;
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

    public async onOpenSelectMessageTemplateDialog(): Promise<void> {
        this.selectMessageTemplateDialog ??= (await this.loadFragment({
            name: "eu.enmeshed.connectorui.view.fragments.SelectMessageTemplateDialog"
        })) as Dialog;
        this.selectMessageTemplateDialog.open();
    }

    public onCloseSelectMessageTemplateDialog(): void {
        (this.byId("selectMessageTemplateDialog") as Dialog)?.close();
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
                    new Filter("translatedStatus", FilterOperator.Contains, sQuery)
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
                    await this.deleteSelectedStudents();
                }
            }
        });
    }

    public async onSendSelectedStudents(): Promise<void> {
        await this.onOpenSelectMessageTemplateDialog();
    }

    public async onMessageTemplateSelected() {
        const messageTemplate = (this.byId("messageTemplateSelect") as Select).getSelectedKey();
        if (!messageTemplate) {
            MessageBox.error("Sie müssen eine Nachricht auswählen, die an die Schüler geschickt werden soll.");
            return;
        }
        await this.sendMessageToSelectedStudents(messageTemplate);
    }

    public async sendMessageToSelectedStudents(messageTemplate: string) {
        this.page.setBusy(true);
        let count = 0;
        try {
            const table = this.byId("table") as Table;
            const selectedIndices = table.getSelectedIndices();

            const items = (table.getBinding() as ListBinding).getAllCurrentContexts();
            let count = 0;
            for (const selectedIndex of selectedIndices) {
                const item = items[selectedIndex];
                if (!item) continue;
                if (item.getProperty("status") !== "active") {
                    continue;
                }
                count++;
                const studentId = item.getProperty("id");

                await this.sendMessage(studentId, messageTemplate);
            }
            await this.loadStudents();
            MessageBox.success(`${count} Nachrichten wurden erfolgreich versandt.`);
        } catch (e: any) {
            console.error(e);
            MessageBox.error(`Beim Nachrichtversand zum Schülers ${e.studentId} ist ein Fehler aufgetreten.`);
        } finally {
            this.page.setBusy(false);
            this.onCloseSelectMessageTemplateDialog();
        }
    }

    public async deleteSelectedStudents() {
        this.page.setBusy(true);
        try {
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
        } catch (e) {
            console.error(e);
        } finally {
            this.page.setBusy(false);
        }
    }

    public onDeleteStudent(event: Button$PressEvent): void {
        MessageBox.confirm("Möchten Sie den Schüler wirklich löschen?", {
            onClose: async (action: string) => {
                if (action === "OK") {
                    const studentId = event.getSource().getBindingContext("studentModel").getProperty("id") as number;
                    await this.deleteStudent(studentId);
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
                    console.error(`Error deleting student ${studentId}:`, error);
                    reject({ studentId, error });
                });
        });
    }

    private async sendMessage(studentId: number, messageTemplate: string, reload: boolean = false): Promise<void> {
        const templates = this.getModel("config").getProperty("/messageTemplates");
        const templateContent = templates.find((x: any) => x.templateKey === messageTemplate);
        return new Promise((resolve, reject) => {
            axios
                .post(
                    `/students/${studentId}/mails`,
                    {
                        subject: templateContent.messageSubject,
                        body: templateContent.messageBody
                    },
                    {
                        headers: {
                            "X-API-KEY": this.getOwnerComponent().getApiKey()
                        }
                    }
                )
                .then(async () => {
                    if (reload) await this.loadStudents();
                    resolve();
                })
                .catch((error) => {
                    console.error(`Error sending message to student ${studentId}: `, error);
                    reject({ studentId, messageTemplate, error });
                });
        });
    }

    private async loadStudents(): Promise<void> {
        const studentModel = this.getModel("studentModel");

        const apiKey = this.getOwnerComponent().getApiKey();
        if (!apiKey) {
            return;
        }

        const studentsResponse = await axios.get<{ result: StudentDTO[] }>("/students", {
            headers: {
                "X-API-KEY": apiKey
            }
        });

        const fetchedStudents = studentsResponse.data.result;
        const students: any[] = [];
        for (const fetchedStudent of fetchedStudents) {
            const student: any = fetchedStudent;
            if (student.status === "active") {
                const studentResponse = await axios.get<any>(`/students/${student.id}/files`, {
                    headers: {
                        "X-API-KEY": apiKey
                    }
                });
                const files: any[] = studentResponse.data.result;
                student.files = files;
                student.filesLength = files.length;
                let pendingFilesLength = 0,
                    acceptedFilesLength = 0,
                    messagesLength = 0;
                for (const doc of files) {
                    if (doc.status === "pending") {
                        pendingFilesLength++;
                    } else if (doc.status === "accepted") {
                        acceptedFilesLength++;
                    }
                }

                student.pendingFilesLength = pendingFilesLength;
                student.acceptedFilesLength = acceptedFilesLength;

                const studentMailResponse = await axios.get<any>(`/students/${student.id}/mails`, {
                    headers: {
                        "X-API-KEY": apiKey
                    }
                });
                const messages: any[] = studentMailResponse.data.result;
                student.messagesLength = messages.length;
            } else {
                student.files = [];
                student.filesLength = 0;
                student.pendingFilesLength = 0;
                student.acceptedFilesLength = 0;
            }
            student.translatedStatus = this.formatStatus(student);
            students.push(student);
        }

        studentModel.setProperty("/students", students);
    }

    public async downloadStudents() {
        try {
            const table = this.byId("table") as Table;
            const selectedIndices = table.getSelectedIndices();
            const selectedStudentIds = [];
            this.page.setBusy(true);
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

    public formatStatus(student: any): string {
        switch (student.status) {
            case "onboarding":
                return "Inaktiv\n(Warten auf Schüler Einwilligung)";
            case "deleted":
                return "Inaktiv\n(Schüler hat sich gelöscht)";
            case "rejected":
                return "Inaktiv\n(Schüler hat Einwilligung abgelehnt)";
            case "active":
                if (student.pendingFilesLength > 0) {
                    return `Aktiv, warten auf Schüler\n(Schüler muss noch Dateien abholen)`;
                } else if (student.acceptedFilesLength > 0) {
                    return `Aktiv\n(Schüler hat alle Dateien abgeholt)`;
                }
                return "Aktiv\n(Keine Dateien vorhanden)";
        }
    }
}
