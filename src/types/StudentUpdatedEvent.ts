import { DataEvent } from "@nmshd/runtime";
import { StudentJSON } from "./Student";

export class StudentUpdatedEvent extends DataEvent<StudentJSON> {
    public static readonly namespace = "school.studentUpdated";

    public constructor(eventTargetAddress: string, data: StudentJSON) {
        super(StudentUpdatedEvent.namespace, eventTargetAddress, data);
    }
}
