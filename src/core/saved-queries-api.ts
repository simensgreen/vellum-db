import {
  deleteSavedQuery,
  getSavedQuery,
  listSavedQueries,
  saveQuery,
  substituteParams,
  type SavedQueryKind,
} from "./saved-queries.ts";
import type {
  AggregateDefinition,
  QueryDefinition,
} from "./query-compile.ts";
import { executeAggregateDefinition } from "./aggregate.ts";
import { executeQueryDefinition } from "./query.ts";
import {
  invalidationTagsForSavedQueriesChange,
} from "./sync-tags.ts";
import { notifyInvalidation } from "./sync.ts";

export type { SavedQueryKind };

export function listSavedQueriesView(input: {
  kind?: SavedQueryKind;
  name_prefix?: string;
  limit?: number;
  offset?: number;
}) {
  const page = listSavedQueries(input);
  return {
    queries: page.queries.map((row) => ({
      name: row.name,
      kind: row.kind,
      description: row.description,
      definition: JSON.parse(row.definition_json),
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    count: page.count,
    limit: page.limit,
    offset: page.offset,
    has_more: page.has_more,
  };
}

export function saveSavedQuery(input: {
  name: string;
  kind: SavedQueryKind;
  definition: unknown;
  description?: string;
}) {
  const saved = saveQuery(input);
  notifyInvalidation(invalidationTagsForSavedQueriesChange());
  return {
    name: saved.name,
    kind: saved.kind,
    description: saved.description,
    definition: JSON.parse(saved.definition_json),
    updated_at: saved.updated_at,
  };
}

export function deleteSavedQueryByName(name: string) {
  deleteSavedQuery(name);
  notifyInvalidation(invalidationTagsForSavedQueriesChange());
  return { deleted: name };
}

export function runSavedQueryView(input: {
  name: string;
  params?: Record<string, unknown>;
}) {
  const saved = getSavedQuery(input.name);
  if (!saved) {
    throw new Error(`Saved query "${input.name}" does not exist`);
  }
  const params = input.params ?? {};
  const definition = substituteParams(
    JSON.parse(saved.definition_json),
    params,
  );
  const kind = saved.kind as SavedQueryKind;
  if (kind === "query") {
    return {
      name: saved.name,
      kind,
      result: executeQueryDefinition(definition as QueryDefinition),
    };
  }
  return {
    name: saved.name,
    kind,
    result: executeAggregateDefinition(definition as AggregateDefinition),
  };
}
