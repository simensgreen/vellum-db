import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { TableDefinition } from "vellum-db/core/table/types";
import { createTable, type TableSummary } from "../api.ts";
import { ColumnCardEditor } from "./ColumnCardEditor.tsx";
import { FormFieldLabel } from "./FormFieldLabel.tsx";
import {
  emptyVisualColumn,
  emptyVisualTable,
  ensurePrimaryKeyColumn,
  markSlugDirty,
  refTargetsFromDefinitions,
  syncSlugFromName,
  syncVisualColumnSlug,
  validateScope,
  validateSlug,
  validateVisualTable,
  type RefTarget,
  type VisualColumn,
  type VisualTable,
} from "../table-definition-editor/index.ts";

export function CreateTableForm({
  existingTables,
  onCancel,
  onCreated,
}: {
  existingTables: TableSummary[];
  onCancel: () => void;
  onCreated: (tableName: string) => void;
}) {
  const refTargets: RefTarget[] = refTargetsFromDefinitions(
    existingTables.map((table) => table.definition),
  );
  const knownTables = new Map<string, TableDefinition>(
    existingTables.map((table) => [table.name, table.definition]),
  );


  const [visual, setVisual] = useState<VisualTable>(emptyVisualTable());
  const [draftColumn, setDraftColumn] = useState<VisualColumn>(() =>
    emptyVisualColumn(),
  );
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const columnNameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusAfterRender = useRef<{ index: number; cursor: number } | null>(null);

  useLayoutEffect(() => {
    const pending = focusAfterRender.current;
    if (pending === null) {
      return;
    }
    focusAfterRender.current = null;
    const input = columnNameRefs.current[pending.index];
    if (input === null || input === undefined) {
      return;
    }
    input.focus();
    input.setSelectionRange(pending.cursor, pending.cursor);
  });

  function updateVisual(patch: Partial<VisualTable>): void {
    setVisual((current) => ({ ...current, ...patch }));
  }

  function handleNameChange(name: string): void {
    const slugSync = syncSlugFromName(name, visual.slugDirty, visual.slug);
    updateVisual({ name, ...slugSync });
  }

  function handleSlugChange(slug: string): void {
    updateVisual(markSlugDirty(slug));
  }

  function mergeColumnPatch(
    column: VisualColumn,
    patch: Partial<VisualColumn>,
  ): VisualColumn {
    const merged = { ...column, ...patch };
    if (column.systemId) {
      merged.primaryKey = true;
      merged.unique = true;
      merged.nullable = false;
    }
    if (patch.primaryKey === true) {
      merged.nullable = false;
    }
    if (patch.name !== undefined && patch.slugDirty !== true) {
      return syncVisualColumnSlug(merged);
    }
    return merged;
  }

  function commitDraftColumn(column: VisualColumn, cursor: number): void {
    setVisual((current) => {
      focusAfterRender.current = { index: current.columns.length, cursor };
      return {
        ...current,
        columns: ensurePrimaryKeyColumn([...current.columns, column]),
      };
    });
    setDraftColumn(emptyVisualColumn());
  }

  function updateDraftColumn(
    patch: Partial<VisualColumn>,
    nameCursor?: number,
  ): void {
    setDraftColumn((current) => {
      const merged = mergeColumnPatch(current, patch);
      if (
        patch.name !== undefined &&
        current.name === "" &&
        patch.name !== ""
      ) {
        const cursor = nameCursor ?? patch.name.length;
        commitDraftColumn(merged, cursor);
        return emptyVisualColumn();
      }
      return merged;
    });
  }

  function updateColumn(index: number, patch: Partial<VisualColumn>): void {
    setVisual((current) => {
      const existing = current.columns[index];
      if (existing === undefined) {
        return current;
      }
      if (patch.name === "" && !existing.systemId) {
        if (current.columns.length <= 1) {
          return current;
        }
        const columns = ensurePrimaryKeyColumn(
          current.columns.filter((_, columnIndex) => columnIndex !== index),
        );
        return { ...current, columns };
      }

      let columns = current.columns.map((column, columnIndex) =>
        columnIndex === index ? mergeColumnPatch(column, patch) : column,
      );
      columns = ensurePrimaryKeyColumn(columns);
      return { ...current, columns };
    });
  }

  function removeColumn(index: number): void {
    setVisual((current) => {
      const column = current.columns[index];
      if (column?.systemId || current.columns.length <= 1) {
        return current;
      }
      const columns = ensurePrimaryKeyColumn(
        current.columns.filter((_, columnIndex) => columnIndex !== index),
      );
      return { ...current, columns };
    });
  }

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    setError(null);
    setHint(null);

    const slugError = validateSlug(visual.slug);
    if (slugError) {
      setError(slugError);
      return;
    }
    const scopeError = validateScope(visual.scope);
    if (scopeError) {
      setError(scopeError);
      return;
    }
    if (!visual.columns.some((column) => column.primaryKey && column.slug.trim())) {
      setError("Mark at least one column as primary key");
      return;
    }
    const validated = validateVisualTable(visual, knownTables);
    if (!validated.ok) {
      setError(validated.msg);
      setHint(validated.hint ?? null);
      return;
    }

    setSubmitting(true);
    try {
      await createTable({
        definition: validated.definition,
        scope: visual.scope.trim(),
      });
      onCreated(validated.definition.slug);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create table",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="form-panel v-card">
      <div class="form-panel__header">
        <h2>New table</h2>
        <button type="button" class="v-button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <form class="form-panel__body" onSubmit={(event) => void handleSubmit(event)}>
        <label class="form-field">
          <FormFieldLabel required>Display name</FormFieldLabel>
          <input
            type="text"
            value={visual.name}
            onInput={(event) =>
              handleNameChange((event.target as HTMLInputElement).value)
            }
            placeholder="My Tasks"
            required
          />
        </label>

        <label class="form-field">
          <FormFieldLabel required>Slug</FormFieldLabel>
          <input
            type="text"
            value={visual.slug}
            onInput={(event) =>
              handleSlugChange((event.target as HTMLInputElement).value)
            }
            placeholder="my_tasks"
            required
          />
        </label>

        <label class="form-field">
          <FormFieldLabel>Description</FormFieldLabel>
          <input
            type="text"
            value={visual.description}
            onInput={(event) =>
              updateVisual({
                description: (event.target as HTMLInputElement).value,
              })
            }
          />
        </label>

        <label class="form-field">
          <FormFieldLabel required>Scope</FormFieldLabel>
          <input
            type="text"
            value={visual.scope}
            onInput={(event) =>
              updateVisual({ scope: (event.target as HTMLInputElement).value })
            }
            placeholder="finance"
          />
        </label>

        <div class="column-cards">
          {visual.columns.map((column, index) => (
            <ColumnCardEditor
              key={column.key}
              column={column}
              refTargets={refTargets}
              nameInputRef={(element) => {
                columnNameRefs.current[index] = element;
              }}
              onUpdate={(patch) => updateColumn(index, patch)}
              onRemove={() => removeColumn(index)}
            />
          ))}
          <ColumnCardEditor
            key={draftColumn.key}
            column={draftColumn}
            isDraft
            refTargets={refTargets}
            nameInputRef={(element) => {
              columnNameRefs.current[visual.columns.length] = element;
            }}
            onUpdate={(patch) => {
              if (patch.name !== undefined) {
                const draftIndex = visual.columns.length;
                const input = columnNameRefs.current[draftIndex];
                updateDraftColumn(
                  patch,
                  input?.selectionStart ?? patch.name.length,
                );
                return;
              }
              updateDraftColumn(patch);
            }}
          />
        </div>

        {error ? <div class="app-message app-message--error">{error}</div> : null}
        {hint ? <div class="app-message app-message--hint">{hint}</div> : null}

        <div class="form-panel__actions">
          <button type="submit" class="v-button" disabled={submitting}>
            {submitting ? "Creating…" : "Create table"}
          </button>
        </div>
      </form>
    </div>
  );
}
