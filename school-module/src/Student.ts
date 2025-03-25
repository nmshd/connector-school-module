import { ISerializable, Serializable, serialize, validate } from "@js-soft/ts-serval";
import { CoreId, ICoreId } from "@nmshd/core-types";
import { RelationshipDTO } from "@nmshd/runtime";

export interface StudentJSON {
    id: string;
    status: string;
    givenname: string;
    surname: string;
    pin?: string;
    correspondingRelationshipTemplateId: string;
    correspondingRelationshipId?: string;
    correspondingRelationship?: RelationshipDTO;
}

export interface IStudent extends ISerializable {
    id: ICoreId;
    status: string;
    givenname: string;
    surname: string;
    pin?: string;
    correspondingRelationshipTemplateId: ICoreId;
    correspondingRelationshipId?: ICoreId;
    correspondingRelationship?: RelationshipDTO;
}

export enum StudentStatus {
    "onboarding" = "onboarding",
    "rejected" = "rejected",
    "active" = "active"
}

export class Student extends Serializable implements IStudent {
    @serialize()
    @validate()
    public id: CoreId;

    @serialize()
    @validate()
    public status: string = "onboarding";

    @serialize()
    @validate()
    public givenname: string;

    @serialize()
    @validate()
    public surname: string;

    @serialize()
    @validate()
    public pin?: string;

    @serialize()
    @validate()
    public correspondingRelationshipTemplateId: CoreId;

    @serialize()
    @validate({ nullable: true })
    public correspondingRelationshipId?: CoreId;

    @serialize()
    @validate({ nullable: true })
    public correspondingRelationship?: any;

    public static from(value: IStudent | StudentJSON): Student {
        return this.fromAny(value);
    }
}
