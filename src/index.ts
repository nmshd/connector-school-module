import { IDatabaseConnection } from "@js-soft/docdb-access-abstractions";
import { MongoDbConnection } from "@js-soft/docdb-access-mongo";
import { sleep } from "@js-soft/ts-utils";
import { ConnectorRuntimeModule, ConnectorRuntimeModuleConfiguration } from "@nmshd/connector-types";
import { LocalAttributeJSON } from "@nmshd/consumption";
import { DisplayNameJSON } from "@nmshd/content";
import { CoreId } from "@nmshd/core-types";
import { OutgoingRequestFromRelationshipCreationCreatedAndCompletedEvent, RelationshipChangedEvent, RelationshipStatus } from "@nmshd/runtime";
import { Container, Scope } from "@nmshd/typescript-ioc";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { StudentsController } from "./StudentsController";

const schoolModuleConfigurationSchema = z.object({
    database: z.object({ connectionString: z.string().optional(), dbName: z.string().optional() }).optional(),
    schoolName: z.string(),
    assetsLocation: z.string()
});

type SchoolModuleConfiguration = ConnectorRuntimeModuleConfiguration & z.infer<typeof schoolModuleConfigurationSchema>;

export default class SchoolModule extends ConnectorRuntimeModule<SchoolModuleConfiguration> {
    #dbConnection: IDatabaseConnection | undefined;
    #studentsController: StudentsController;

    public async init(): Promise<void> {
        const result = schoolModuleConfigurationSchema.safeParse(this.configuration);
        if (!result.success) throw new Error(`Invalid configuration: ${fromError(result.error)}`);

        const dbConnection = await this.getOrCreateDbConnection();

        const database = await dbConnection.getDatabase(
            this.configuration.database?.dbName ?? `${this.runtime.runtimeConfig.database.dbNamePrefix}${this.runtime.runtimeConfig.database.dbName}`
        );

        const displayName = await this.getOrCreateDisplayNameAttribute();
        this.#studentsController = await new StudentsController(displayName, this.runtime.getServices(), database, this.configuration.assetsLocation).init();

        Container.bind(StudentsController)
            .factory(() => this.#studentsController)
            .scope(Scope.Singleton);

        this.runtime.infrastructure.httpServer.addControllers(["controllers/*.js", "controllers/*.ts", "!controllers/*.d.ts"], __dirname);
    }

    private async getOrCreateDbConnection(): Promise<IDatabaseConnection> {
        if (!this.configuration.database?.connectionString) return this.runtime.databaseConnection;

        const mongoDbConnection = new MongoDbConnection(this.configuration.database.connectionString);
        this.#dbConnection = mongoDbConnection;

        try {
            await mongoDbConnection.connect();

            return mongoDbConnection;
        } catch (e) {
            throw new Error(`Could not connect to the configured database. Try to check the connection string and the database status. Root error: ${e}`);
        }
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

    public start(): void {
        this.subscribeToEvent(OutgoingRequestFromRelationshipCreationCreatedAndCompletedEvent, async (event) => {
            const student = await this.#studentsController.getStudentByTemplateId(event.data.source!.reference);

            const relationshipId = event.data.response!.source!.reference;
            student.correspondingRelationshipId = CoreId.from(relationshipId);

            await this.#studentsController.updateStudent(student);

            await this.runtime.getServices().transportServices.relationships.acceptRelationship({ relationshipId });
        });

        this.subscribeToEvent(RelationshipChangedEvent, async (event) => {
            if (event.data.status !== RelationshipStatus.DeletionProposed) return;

            const relationshipId = event.data.id;

            const student = await this.#studentsController.getStudentByRelationshipId(relationshipId);
            await this.#studentsController.deleteStudent(student);

            // wait for 500ms to ensure that no race conditions occur with other external events from the same sync run that triggered this event
            await sleep(500);

            await this.runtime.getServices().transportServices.relationships.decomposeRelationship({ relationshipId });
        });
    }

    public async stop(): Promise<void> {
        await this.#dbConnection?.close();
    }
}
