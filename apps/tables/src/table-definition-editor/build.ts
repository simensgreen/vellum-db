import type { ColumnDefinition, TableDefinition } from "vellum-db/core/table/types";
import { slugify } from "vellum-db/slugify";
import { emptyVisualColumn, systemIdVisualColumn } from "./defaults.ts";
import type { VisualColumn, VisualTable } from "./types.ts";

function columnSlugFromName(name: string, slugDirty: boolean, currentSlug: string): string {
  if (slugDirty && currentSlug.trim()) {
    return currentSlug.trim();
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }
  try {
    return slugify(trimmed);
  } catch {
    return currentSlug;
  }
}

export function visualToTableDefinition(visual: VisualTable): TableDefinition {
  const columns: ColumnDefinition[] = visual.columns
    .filter((column) => column.slug.trim())
    .map((column) => ({
      name: column.name.trim() || column.slug.trim(),
      slug: column.slug.trim(),
      ...(column.description.trim() ? { description: column.description.trim() } : {}),
      ...(column.nullable ? { nullable: true } : {}),
      ...(column.unique ? { unique: true } : {}),
      ...(column.primaryKey ? { primaryKey: true } : {}),
      data: column.data,
    }));

  const definition: TableDefinition = {
    slug: visual.slug.trim(),
    name: visual.name.trim() || visual.slug.trim(),
    columns,
  };

  if (visual.description.trim()) {
    definition.description = visual.description.trim();
  }
  if (visual.scope.trim()) {
    definition.scope = visual.scope.trim();
  }

  return definition;
}

export function tableDefinitionToVisual(definition: TableDefinition): VisualTable {
  return {
    name: definition.name,
    slug: definition.slug,
    slugDirty: true,
    description: definition.description ?? "",
    scope: definition.scope ?? "",
    columns:
      definition.columns.length > 0
        ? definition.columns.map((column: TableDefinition["columns"][number]) => ({
            key: crypto.randomUUID(),
            name: column.name,
            slug: column.slug,
            slugDirty: true,
            description: column.description ?? "",
            nullable: column.nullable === true,
            unique: column.unique === true,
            primaryKey: column.primaryKey === true,
            data: column.data,
          }))
        : [systemIdVisualColumn()],
  };
}

export function syncVisualColumnSlug(column: VisualColumn): VisualColumn {
  return {
    ...column,
    slug: columnSlugFromName(column.name, column.slugDirty, column.slug),
  };
}

export function visualColumnFromName(name: string): VisualColumn {
  const column = emptyVisualColumn();
  column.name = name;
  return syncVisualColumnSlug(column);
}

function hasPrimaryKeyColumn(columns: VisualColumn[]): boolean {
  return columns.some((column) => column.primaryKey && column.slug.trim());
}

export function ensurePrimaryKeyColumn(columns: VisualColumn[]): VisualColumn[] {
  if (hasPrimaryKeyColumn(columns)) {
    return columns;
  }
  const firstWithSlug = columns.findIndex((column) => column.slug.trim());
  if (firstWithSlug < 0) {
    return columns;
  }
  return columns.map((column, index) =>
    index === firstWithSlug ? { ...column, primaryKey: true, nullable: false } : column,
  );
}
