import { z } from "zod";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import "@/lib/api-v1/openapi/registry";

const DbmsEnum = z.enum([
  "postgresql",
  "mysql",
  "mariadb",
  "mongodb",
  "sqlite",
  "redis",
  "valkey",
  "firebird",
  "mssql",
]);

const StatusEnum = z.enum(["waiting", "ongoing", "failed", "success"]);

const BackupStorageStatusEnum = z.enum(["pending", "success", "failed"]);

const DatabaseSchema = z
  .object({
    id: z.string().uuid(),
    agentDatabaseId: z.string().uuid(),
    name: z.string(),
    dbms: DbmsEnum,
    description: z.string().nullable(),
    backupPolicy: z.string().nullable(),
    isWaitingForBackup: z.boolean(),
    backupToRestore: z.string().nullable(),
    healthErrorCount: z.number().int().nullable(),
    agentId: z.string().uuid(),
    lastContact: z.string().datetime().nullable(),
    projectId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable(),
  })
  .openapi("Database");

const BackupStorageSchema = z
  .object({
    id: z.string().uuid(),
    backupId: z.string().uuid(),
    storageChannelId: z.string().uuid(),
    status: BackupStorageStatusEnum,
    path: z.string().nullable(),
    size: z.number().nullable(),
    checksum: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable(),
  })
  .openapi("BackupStorage");

const BackupSchema = z
  .object({
    id: z.string().uuid(),
    status: StatusEnum,
    file: z.string().nullable(),
    fileSize: z.number().nullable(),
    databaseId: z.string().uuid(),
    imported: z.boolean().nullable(),
    migrated: z.boolean().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable(),
  })
  .openapi("Backup");

const BackupWithStoragesSchema = BackupSchema.extend({
  storages: z.array(BackupStorageSchema),
}).openapi("BackupWithStorages");

const RestorationSchema = z
  .object({
    id: z.string().uuid(),
    status: StatusEnum,
    backupStorageId: z.string().uuid().nullable(),
    backupId: z.string().uuid(),
    databaseId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable(),
  })
  .openapi("Restoration");

const UuidParam = z
  .string()
  .uuid()
  .openapi({ example: "123e4567-e89b-12d3-a456-426614174000" });

const security = [{ apiKeyAuth: [] }];

const ErrorSchema = z.object({ error: z.string() });

export function registerDatabaseRoutes(registry: OpenAPIRegistry) {
  registry.register("Database", DatabaseSchema);
  registry.register("Backup", BackupSchema);
  registry.register("BackupStorage", BackupStorageSchema);
  registry.register("BackupWithStorages", BackupWithStoragesSchema);
  registry.register("Restoration", RestorationSchema);

  registry.registerPath({
    method: "get",
    path: "/databases",
    summary: "List databases",
    security,
    responses: {
      200: {
        description: "List of accessible databases",
        content: {
          "application/json": {
            schema: z.object({ data: z.array(DatabaseSchema) }),
          },
        },
      },
      401: {
        description: "Missing or invalid API key",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/databases/{id}",
    summary: "Get database by ID",
    security,
    request: { params: z.object({ id: UuidParam }) },
    responses: {
      200: {
        description: "Database details",
        content: {
          "application/json": {
            schema: z.object({ data: DatabaseSchema }),
          },
        },
      },
      401: {
        description: "Missing or invalid API key",
        content: { "application/json": { schema: ErrorSchema } },
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "Database not found",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/databases/{id}/status",
    summary: "Get database status",
    security,
    request: { params: z.object({ id: UuidParam }) },
    responses: {
      200: {
        description: "Database status with latest backup and restoration",
        content: {
          "application/json": {
            schema: z.object({
              data: z.object({
                isWaitingForBackup: z.boolean().nullable(),
                lastContact: z.string().datetime().nullable(),
                latestBackup: BackupSchema.nullable(),
                latestRestoration: RestorationSchema.nullable(),
              }),
            }),
          },
        },
      },
      401: {
        description: "Missing or invalid API key",
        content: { "application/json": { schema: ErrorSchema } },
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "Database not found",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/databases/{id}/backup",
    summary: "List backups for a database",
    security,
    request: { params: z.object({ id: UuidParam }) },
    responses: {
      200: {
        description: "List of backups ordered by creation date descending",
        content: {
          "application/json": {
            schema: z.object({ data: z.array(BackupSchema) }),
          },
        },
      },
      401: {
        description: "Missing or invalid API key",
        content: { "application/json": { schema: ErrorSchema } },
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "Database not found",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/databases/{id}/backup",
    summary: "Trigger a backup for a database",
    security,
    request: { params: z.object({ id: UuidParam }) },
    responses: {
      201: {
        description: "Backup job created with status 'waiting'",
        content: {
          "application/json": { schema: z.object({ data: BackupSchema }) },
        },
      },
      401: {
        description: "Missing or invalid API key",
        content: { "application/json": { schema: ErrorSchema } },
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "Database not found",
        content: { "application/json": { schema: ErrorSchema } },
      },
      409: {
        description: "A backup is already waiting or ongoing for this database",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/databases/{id}/backup/{backupId}",
    summary: "Get a specific backup with storage details",
    security,
    request: {
      params: z.object({ id: UuidParam, backupId: UuidParam }),
    },
    responses: {
      200: {
        description: "Backup with associated storage records",
        content: {
          "application/json": {
            schema: z.object({ data: BackupWithStoragesSchema }),
          },
        },
      },
      401: {
        description: "Missing or invalid API key",
        content: { "application/json": { schema: ErrorSchema } },
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "Database or backup not found",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/databases/{id}/restore",
    summary: "Restore a database from a backup",
    security,
    request: {
      params: z.object({ id: UuidParam }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              backupId: z.string().uuid(),
              backupStorageId: z.string().uuid(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Restoration job created with status 'waiting'",
        content: {
          "application/json": {
            schema: z.object({ data: RestorationSchema }),
          },
        },
      },
      401: {
        description: "Missing or invalid API key",
        content: { "application/json": { schema: ErrorSchema } },
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "Database, backup, or backup storage not found",
        content: { "application/json": { schema: ErrorSchema } },
      },
      409: {
        description:
          "A restoration is already waiting or ongoing for this database",
        content: { "application/json": { schema: ErrorSchema } },
      },
      422: {
        description:
          "Invalid request body, or backup storage is not in 'success' state",
        content: { "application/json": { schema: ErrorSchema } },
      },
      500: {
        description: "Internal server error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });
}
