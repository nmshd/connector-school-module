import { ISerializable, Serializable, serialize, validate } from "@js-soft/ts-serval";
import { CoreId, ICoreId } from "@nmshd/core-types";

export interface StudentJSON {
    id: string;
    correspondingRelationshipTemplate: string;
    correspondingRelationship?: string;
}

export interface IStudent extends ISerializable {
    id: ICoreId;
    correspondingRelationshipTemplate: ICoreId;
    correspondingRelationship?: ICoreId;
}

export class Student extends Serializable implements IStudent {
    @serialize()
    @validate()
    public id: CoreId;

    @serialize()
    @validate()
    public correspondingRelationshipTemplate: CoreId;

    @serialize()
    @validate({ nullable: true })
    public correspondingRelationship?: CoreId;

    public static from(value: IStudent | StudentJSON): Student {
        return this.fromAny(value);
    }
}
