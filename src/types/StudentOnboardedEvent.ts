import { DataEvent } from "@nmshd/runtime";
import { StudentJSON } from "./Student";

export class StudentOnboardedEvent extends DataEvent<StudentJSON> {
    public static readonly namespace = "school.studentOnboarded";

    public constructor(eventTargetAddress: string, data: StudentJSON) {
        super(StudentOnboardedEvent.namespace, eventTargetAddress, data);
    }
}
