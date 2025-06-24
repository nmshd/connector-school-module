import * as Device from "sap/ui/Device";
import BindingMode from "sap/ui/model/BindingMode";
import JSONModel from "sap/ui/model/json/JSONModel";

export default {
    createDeviceModel: () => {
        const oModel = new JSONModel(Device);
        oModel.setDefaultBindingMode(BindingMode.OneWay);
        return oModel;
    },

    studentModel: () => {
        const oModel = new JSONModel({});
        oModel.setDefaultBindingMode(BindingMode.TwoWay);
        return oModel;
    }
};
