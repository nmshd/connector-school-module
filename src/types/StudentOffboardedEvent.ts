import { DataEvent } from "@nmshd/runtime";
import { StudentJSON } from "./Student";

export class StudentOffboardedEvent extends DataEvent<StudentJSON> {
    public static readonly namespace = "school.studentOffboarded";

    public constructor(eventTargetAddress: string, data: StudentJSON) {
        super(StudentOffboardedEvent.namespace, eventTargetAddress, data);
    }
}
