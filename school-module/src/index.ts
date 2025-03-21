import { ConnectorRuntimeModule, ConnectorRuntimeModuleConfiguration } from "@nmshd/connector-types";
import { LocalAttributeJSON } from "@nmshd/consumption";
import { DisplayNameJSON } from "@nmshd/content";
import { CoreId } from "@nmshd/core-types";
import { OutgoingRequestFromRelationshipCreationCreatedAndCompletedEvent, RelationshipChangedEvent, RelationshipStatus } from "@nmshd/runtime";
import { Container, Scope } from "@nmshd/typescript-ioc";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { StudentsController } from "./StudentsController";

interface SchoolModuleConfiguration extends ConnectorRuntimeModuleConfiguration {
    database: {
        connectionString: string;
        dbName: string;
    };
    schoolName: string;
}

const schoolModuleConfigurationSchema = z.object({
    database: z.object({
        connectionString: z.string(),
        dbName: z.string()
    }),
    schoolName: z.string()
});

export default class SchoolModule extends ConnectorRuntimeModule<SchoolModuleConfiguration> {
    #studentsRepository: StudentsController;

    public async init(): Promise<void> {
        const result = schoolModuleConfigurationSchema.safeParse(this.configuration);
        if (!result.success) throw new Error(`Invalid configuration: ${fromError(result.error)}`);

        const displayName = await this.getOrCreateDisplayNameAttribute();
        this.#studentsRepository = StudentsController.create(displayName, this.runtime.getServices());

        Container.bind(StudentsController)
            .factory(() => this.#studentsRepository)
            .scope(Scope.Singleton);

        this.runtime.infrastructure.httpServer.addControllers(["controllers/*.js", "controllers/*.ts", "!controllers/*.d.ts"], __dirname);
    }

    private async getOrCreateDisplayNameAttribute(): Promise<LocalAttributeJSON> {
        const services = this.runtime.getServices();

        const getAttributesResponse = await services.consumptionServices.attributes.getRepositoryAttributes({ query: { "content.value.@type": "DisplayName" } });

        if (getAttributesResponse.isSuccess && getAttributesResponse.value.length > 0) {
            const attribute = getAttributesResponse.value.find((attribute) => (attribute.content.value as DisplayNameJSON).value === this.configuration.schoolName);
            if (attribute) return attribute;
        }

        const createResponse = await services.consumptionServices.attributes.createRepositoryAttribute({
            content: { value: { "@type": "DisplayName", value: this.configuration.schoolName } }
        });

        if (createResponse.isError) throw createResponse.error;

        const createdAttribute = createResponse.value;
        return createdAttribute;
    }

    public async start(): Promise<void> {
        this.subscribeToEvent(OutgoingRequestFromRelationshipCreationCreatedAndCompletedEvent, async (event) => {
            const student = await this.#studentsRepository.getStudentByTemplateId(event.data.source!.reference);

            const relationshipId = event.data.response!.source!.reference;
            student.correspondingRelationship = CoreId.from(relationshipId);

            await this.#studentsRepository.updateStudent(student);

            await this.runtime.getServices().transportServices.relationships.acceptRelationship({ relationshipId });
        });

        this.subscribeToEvent(RelationshipChangedEvent, async (event) => {
            if (event.data.status !== RelationshipStatus.DeletionProposed) return;

            const relationshipId = event.data.id;

            const student = await this.#studentsRepository.getStudentByRelationshipId(relationshipId);
            await this.#studentsRepository.deleteStudent(student);

            await this.runtime.getServices().transportServices.relationships.decomposeRelationship({ relationshipId });
            await this.runtime.getServices().transportServices.relationshipTemplates.deleteRelationshipTemplate({ templateId: event.data.template.id });
        });
    }
}
