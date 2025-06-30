import DateFormat from "sap/ui/core/format/DateFormat";

const parser = DateFormat.getDateInstance({
    pattern: "dd.MM.yyyy HH:mm:ss"
});

export default {
    formatStatus(value: string): string {
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
    },
    formatFileStatus(value: string): string {
        switch (value) {
            case "accepted":
                return "Akzeptiert";
            case "pending":
                return "Warten auf Schüler";
            case "rejected":
                return "Abgelehnt";
        }
    },

    formateDate(value: string): string {
        return parser.format(new Date(value));
    }
};
