import axios from "axios";
import List from "sap/m/List";
import { SearchField$SearchEvent } from "sap/m/SearchField";
import Device from "sap/ui/Device";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ODataListBinding from "sap/ui/model/odata/v2/ODataListBinding";
import Sorter from "sap/ui/model/Sorter";
import { CustomListItem$DetailClickEvent } from "sap/ui/webc/main/CustomListItem";
import { Student } from "../../../src/types";
import BaseController from "./BaseController";

/**
 * @namespace eu.enmeshed.connectorui.controller
 */
export default class Master extends BaseController {
    private descendingSort = false;

    async onBeforeRendering(): Promise<void | undefined> {
        const studentModel = this.getModel("studentModel");

        const getStudentsResponse = await axios.get<{ result: Student[] }>(
            "/students",
            {
                headers: {
                    "X-API-KEY": this.getOwnerComponent().getApiKey()
                }
            }
        );

        studentModel.setProperty("/students", getStudentsResponse.data.result);
    }

    private async onListItemPress(
        event: CustomListItem$DetailClickEvent
    ): Promise<void> {
        const replace = !Device.system.phone,
            id = event
                .getSource()
                .getBindingContext("studentModel")
                .getProperty("id") as number,
            helper = await this.getOwnerComponent().getHelper(),
            nextUIState = helper.getNextUIState(1);
        this.getRouter().navTo(
            "detail",
            { id: id, layout: nextUIState.layout },
            {},
            replace
        );
    }

    private onSearch(event: SearchField$SearchEvent) {
        const query = event.getParameter("query");
        let tableSearchState: Array<Filter> = [];

        if (query && query.length > 0) {
            tableSearchState = [
                new Filter("Name", FilterOperator.Contains, query)
            ];
        }

        (
            (this.getView().byId("productsTable") as List).getBinding(
                "items"
            ) as ODataListBinding
        ).filter(tableSearchState, "Application");
    }

    private onSort() {
        this.descendingSort = !this.descendingSort;
        const view = this.getView(),
            table = view.byId("productsTable") as List,
            binding = table.getBinding("items") as ODataListBinding,
            sorter = new Sorter("Name", this.descendingSort);

        binding.sort(sorter);
    }
}
