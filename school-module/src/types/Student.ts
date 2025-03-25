import { ISerializable, Serializable, serialize, validate } from "@js-soft/ts-serval";
import { CoreId, ICoreId } from "@nmshd/core-types";

export interface StudentJSON {
    id: string;
    givenname: string;
    surname: string;
    correspondingRelationshipTemplateId: string;
    correspondingRelationshipId?: string;
}

export interface IStudent extends ISerializable {
    id: ICoreId;
    givenname: string;
    surname: string;
    correspondingRelationshipTemplateId: ICoreId;
    correspondingRelationshipId?: ICoreId;
}

export class Student extends Serializable implements IStudent {
    @serialize()
    @validate()
    public id: CoreId;

    @serialize()
    @validate()
    public givenname: string;

    @serialize()
    @validate()
    public surname: string;

    @serialize()
    @validate()
    public correspondingRelationshipTemplateId: CoreId;

    @serialize()
    @validate({ nullable: true })
    public correspondingRelationshipId?: CoreId;

    public static from(value: IStudent | StudentJSON): Student {
        return this.fromAny(value);
    }

    public toJSON(verbose?: boolean, serializeAsString?: boolean): StudentJSON {
        return super.toJSON(verbose, serializeAsString) as StudentJSON;
    }
}
