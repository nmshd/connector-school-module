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

    private async onObjectMatched(event: Route$MatchedEvent) {
        const studentModel = this.getModel("studentModel");

        const studentsResponse = await axios.get<{ result: StudentDTO[] }>("/students", {
            headers: {
                "X-API-KEY": this.getOwnerComponent().getApiKey()
            }
        });

        studentModel.setProperty("/students", studentsResponse.data.result);
    }

    public onCSVFileChanged(event: FileUploader$ChangeEvent) {
        this.csvFile = event.getParameter("files");
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
        const readers = [];

        readers.push(this.readFileAsText([this.csvFile, this.configFile]));

        console.log(await Promise.all(readers));

        // reader.onload = async (event) => {
        //     await axios.post(
        //         "/students/create/batch",
        //         {
        //             students: event.target.result,
        //             options: {
        //                 createDefaults: {
        //                     additionalConsents: [
        //                         {
        //                             mustBeAccepted: true,
        //                             consent:
        //                                 "Ich beauftrage die Erstellung einer digitalen Zeugnisausfertigung zu meinem Zeugnis der allgemeinen Hochschulreife. Die digitale Zeugnisausfertigung erhalte ich als PDF-Datei mit einem XML-Anhang im XSchule-Format, der maximal die Inhalte meines Zeugnisses in maschinenverarbeitbarer Form enthält."
        //                         },
        //                         {
        //                             mustBeAccepted: true,
        //                             consent:
        //                                 "Ich nehme zur Kenntnis, dass die digitale Zeugnisausfertigung im Rahmen eines Feldtests erstellt wird, dass eine Bewerbung bzw. Immatrikulation mit der digitalen Zeugnisausfertigung nur bei teilnehmenden Hochschulen möglich ist und dass die Nutzungsmöglichkeit der digitalen Zeugnisausfertigung nach dem Jahr 2025 weiter eingeschränkt sein oder enden kann."
        //                         },
        //                         {
        //                             mustBeAccepted: true,
        //                             consent:
        //                                 "Ich nehme die folgenden Informationen zur Datenverarbeitung und zum Datenschutz zur Kenntnis und akzeptiere diese:\n\nDatenschutzerklärung Digitale Zeugnisausfertigung\nIm Rahmen des Feldtestes „Digitale Zeugnisausfertigungen 2025“ bieten Ihnen Ihre Schule und das Land Nordrhein-Westfalen unter Mitwirkung des Landes Sachsen-Anhalt und des Projektes „Mein Bildungsraum“ der SPRIND GmbH (Bundesagentur für Sprunginnovation) und des BMBF (Bundesministerium für Bildung und Forschung) die Möglichkeit, zusätzlich zu Ihrem analogen Abiturzeugnis eine digitale Zeugnisausfertigung mit einem elektronischen Siegel zu erhalten. In diesem Zusammenhang werden Ihre personenbezogenen Daten verarbeitet. Der Schutz Ihrer Daten ist dabei allen Beteiligten ein besonderes Anliegen.\n\nAus dieser und den verlinkten Datenschutzerklärungen können Sie folgende Informationen entnehmen:\n• den Umfang der im Zusammenhang mit der Anforderung und Erstellung einer digitalen Zeugnisausfertigung verarbeiteten Daten,\n• durch wen, zu welchem Zweck und auf welcher Grundlage diese Verarbeitung erfolgt, \n• wie Sie die verantwortliche Stelle und die/den Datenschutzbeauftragte/n kontaktieren können und \n• welche Rechte Sie in Bezug auf die Verarbeitung Ihrer personenbezogenen Daten haben.\nBitte beachten Sie, dass die Informationen im Folgenden nach den Teilprozessen differenziert dargestellt werden: Abschnitt I geht auf die Datenverarbeitungen im Fachverfahren(das ist das durch Ihre Schule genutzte Schulverwaltungssystem) ein. Abschnitt II geht auf die Datenverarbeitung im Rahmen der Nutzung der Dienste von „Mein Bildungsraum“ zur elektronischen Siegelung Ihrer digitalen Zeugnisausfertigung und deren Zustellung an die App auf Ihrem Mobilgerät ein.\nI. Datenverarbeitung im Fachverfahren durch die Schule\nZweck und Rechtsgrundlage: Zum Zwecke der Erstellung der digitalen Zeugnisausfertigung findet eine Verarbeitung der dazu notwendigen personenbezogenen Daten im Rahmen der bestehenden Datenverarbeitung durch die Schule gem. §121 SchulG NRW und der „Verordnung über die zur Verarbeitung zugelassenen Daten von Schülerinnen, Schülern und Eltern“ (VO-DV I) statt.\nVerantwortliche Stelle: Für die genannte Datenverarbeitung ist die besuchte Schule verantwortlich.\nUmfang der Verarbeitung personenbezogener Daten: Die im Rahmen der Erstellung Ihrer digitalen Zeugnisausfertigung verarbeiteten Daten entsprechen den Daten, die auch zur Erstellung des Originalzeugnisses verwendet werden, erweitert um die elektronische Signatur der digitalen Zeugnisausfertigung. Die Verarbeitung findet in beiden Fällen auf derselben durch die Schule ausgewählten IT-Infrastruktur statt. Darüber hinaus werden im Rahmen des Antrages die folgenden Daten verarbeitet: Zugangsdaten zur Schüler-Wallet, die Zustimmung des Schülers/der Schülerin, Information über die erfolgte Zustellung der digitalen Zeugnisausfertigung.\nDauer der Speicherung: Aufbewahrungs- und Löschfristen hierzu regelt §9 VO-DV I. Die o. g. Antragsdaten werden für die Dauer von max. 12 Monaten gespeichert.\nWeitergabe personenbezogener Daten: Es erfolgt im Rahmen des Fachverfahrens keine Weitergabe der personenbezogenen Daten an andere Stellen.\nBetroffenenrechte: Für die seit Eintritt in die Schule stattfindende Verarbeitung personenbezogener Daten gelten folgende Rechte: Recht auf Auskunft, Recht auf Berichtigung, Recht auf Löschung, Recht auf Einschränkung, Recht auf Widerspruch.\nBeschwerderecht bei der Aufsichtsbehörde: Jede betroffene Person hat das Recht auf Beschwerde beim LDI NRW, dem Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Kavalleriestr. 2-4, 40213 Düsseldorf.\nII Datenverarbeitung im Zusammenhang mit der Nutzung von Komponenten von „Mein Bildungsraum“\nZur elektronischen Siegelung der digitalen Zeugnisausfertigung und zum Zwecke ihrer Zustellung an die App auf dem Mobilgerät des Schülers/der Schülerin werden Komponenten von „Mein Bildungsraum“ gemäß der auf https://www.meinbildungsraum.de/datenschutz bereitgestellten Datenschutzerklärung genutzt. Die dort unter 3 a genannte Komponente zur elektronischen Siegelung wird so an das Fachverfahren angebunden, dass nur die dazu notwendigen Hash-Werte, nicht jedoch die Inhalte der digitalen Zeugnisausfertigung an die Server von „Mein Bildungsraum“ übertragen werden. Außerdem geschieht die Zustellung der digitalen Zeugnisausfertigung von der Schule an die App auf dem Mobilgerät des Schülers/der Schülerin gemäß den Bedingungen unter https://www.meinbildungsraum.de/datenschutz/wallet Ende-zu-Ende verschlüsselt. Das bedeutet, dass die digitale Zeugnisausfertigung auf den Servern von „Mein Bildungsraum“ nicht entschlüsselt wird und im Rahmen dieses Verfahrens nur durch die Schule und den jeweiligen Schüler/die jeweilige Schülerin eingesehen werden kann.\n"
        //                         }
        //                     ]
        //                 },
        //                 sendDefaults: {
        //                     messageBody:
        //                         "Guten Tag {{student.givenname}} {{student.surname}}, herzlichen Glückwunsch für das bestandene Abitur. Anbei erhältst du die digitale Zeugnisausfertigung."
        //                 },
        //                 pdfDefaults: {
        //                     fields: {
        //                         schoolname: "{{organization.displayName}}",
        //                         salutation: "Guten Tag {{student.givenname}} {{student.surname}},",
        //                         greeting: "{{organization.displayName}}",
        //                         place_date: "<Schulort> "
        //                     },

        //                     logo: {
        //                         x: 15,
        //                         y: 15,
        //                         maxWidth: 170,
        //                         maxHeight: 40,
        //                         bytes: "<Schullogo>"
        //                     }
        //                 }
        //             }
        //         },
        //         {
        //             headers: {
        //                 "X-API-KEY": this.getOwnerComponent().getApiKey()
        //             }
        //         }
        //     );
        // };
        // reader.readAsText(this.csvFile);
        // reader.readAsText(this.configFile)
    }

    private readFileAsText(file: any): Promise<any> {
        return new Promise(function (resolve, reject) {
            const fr = new FileReader();

            fr.onload = function () {
                resolve(fr.result);
            };

            fr.readAsText(file);
        });
    }
}
