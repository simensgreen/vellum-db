import type { MigrationFile } from "../api/schemas/migrate.ts";
import {
  getTableColumns,
  parseTableDefinition,
  requireTable,
} from "./catalog.ts";
import { applyInlineMigration } from "./migrate.ts";
import type { TableDefinition } from "./table/types.ts";
import { extractViewParamNames } from "./views.ts";
import { getView, type ViewKind } from "./views.ts";

function apiMigrationName(operation: string, target: string): string {
  const timestamp = new Date().toISOString();
  return `api:${operation}:${target}:${timestamp}`;
}

export function migrateCreateTable(input: {
  definition: TableDefinition;
  scope?: string | null;
}) {
  const migration: MigrationFile = {
    version: 1,
    create: [
      {
        definition: input.definition,
        ...(Object.prototype.hasOwnProperty.call(input, "scope")
          ? { scope: input.scope }
          : {}),
      },
    ],
  };
  return applyInlineMigration({
    name: apiMigrationName("create", input.definition.slug),
    migration,
  });
}

export function migrateAlterTable(input: {
  table: string;
  add?: Array<{
    name: string;
    slug: string;
    column: TableDefinition["columns"][number];
  }>;
  drop?: string[];
  scope?: string | null;
}) {
  const migration: MigrationFile = {
    version: 1,
    alter: [
      {
        table: input.table,
        add: input.add,
        drop: input.drop,
        ...(Object.prototype.hasOwnProperty.call(input, "scope")
          ? { scope: input.scope }
          : {}),
      },
    ],
  };
  return applyInlineMigration({
    name: apiMigrationName("alter", input.table),
    migration,
  });
}

export function migrateDropTable(input: { table: string }) {
  const migration: MigrationFile = {
    version: 1,
    drop: [input.table],
  };
  return applyInlineMigration({
    name: apiMigrationName("drop", input.table),
    migration,
  });
}

export function migrateSaveView(input: {
  slug: string;
  name: string;
  kind: ViewKind;
  definition: unknown;
  description?: string;
  scope?: string | null;
}) {
  const migration: MigrationFile = {
    version: 1,
    views: [
      {
        slug: input.slug,
        name: input.name,
        kind: input.kind,
        definition: input.definition as Record<string, unknown>,
        description: input.description,
        ...(Object.prototype.hasOwnProperty.call(input, "scope")
          ? { scope: input.scope }
          : {}),
      },
    ],
  };
  return applyInlineMigration({
    name: apiMigrationName("save_view", input.slug),
    migration,
  });
}

export function migrateDeleteView(input: { slug: string }) {
  const migration: MigrationFile = {
    version: 1,
    delete_views: [input.slug],
  };
  return applyInlineMigration({
    name: apiMigrationName("delete_view", input.slug),
    migration,
  });
}

function tableSummary(tableName: string) {
  const table = requireTable(tableName);
  return {
    name: table.name,
    scope: table.scope,
    definition: parseTableDefinition(table),
    columns: getTableColumns(table),
    created_at: table.created_at,
    updated_at: table.updated_at,
  };
}

function viewSummary(slug: string) {
  const saved = getView(slug);
  if (!saved) {
    throw new Error(`View "${slug}" does not exist`);
  }
  const definition = JSON.parse(saved.definition_json);
  return {
    slug: saved.slug,
    name: saved.name,
    kind: saved.kind,
    scope: saved.scope,
    description: saved.description,
    definition,
    param_names: extractViewParamNames(definition),
    updated_at: saved.updated_at,
  };
}

export function migrateCreateTableApi(input: {
  definition: TableDefinition;
  scope?: string | null;
}) {
  migrateCreateTable(input);
  return tableSummary(input.definition.slug);
}

export function migrateAlterTableApi(input: {
  table: string;
  add?: Array<{
    name: string;
    slug: string;
    column: TableDefinition["columns"][number];
  }>;
  drop?: string[];
  scope?: string | null;
}) {
  migrateAlterTable(input);
  return tableSummary(input.table);
}

export function migrateDropTableApi(input: { table: string }) {
  migrateDropTable(input);
  return { name: input.table };
}

export function migrateSaveViewApi(input: {
  slug: string;
  name: string;
  kind: ViewKind;
  definition: unknown;
  description?: string;
  scope?: string | null;
}) {
  migrateSaveView(input);
  return viewSummary(input.slug);
}

export function migrateDeleteViewApi(input: { slug: string }) {
  migrateDeleteView(input);
  return { deleted: input.slug };
}
