import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { alterTable, type TableSummary } from "../api.ts";
import {
  emptyVisualColumn,
  parseJsonSchemaText,
  type VisualColumn,
  type VisualColumnType,
} from "../schema-editor/index.ts";

type TabId = "visual" | "advanced";

const COLUMN_TYPES: VisualColumnType[] = [
  "string",
  "integer",
  "number",
  "boolean",
];

function existingColumnNames(table: TableSummary): Set<string> {
  return new Set(table.columns.map((column) => column.name));
}

export function EditTableForm({
  table,
  onCancel,
  onSaved,
}: {
  table: TableSummary;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const existingNames = useMemo(() => existingColumnNames(table), [table]);
  const [tab, setTab] = useState<TabId>("visual");
  const [newColumns, setNewColumns] = useState<VisualColumn[]>([emptyVisualColumn()]);
  const [dropColumns, setDropColumns] = useState<Set<string>>(new Set());
  const [advancedText, setAdvancedText] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const syncAdvancedFromVisual = useCallback(() => {
    const addPayload = newColumns
      .filter((column) => column.name.trim())
      .map((column) => ({
        name: column.name.trim(),
        schema: { type: column.type },
      }));
    const payload: Record<string, unknown> = {};
    if (addPayload.length > 0) {
      payload.add = addPayload;
    }
    if (dropColumns.size > 0) {
      payload.drop = [...dropColumns];
    }
    setAdvancedText(JSON.stringify(payload, null, 2));
  }, [newColumns, dropColumns]);

  useEffect(() => {
    if (tab === "visual") {
      syncAdvancedFromVisual();
    }
  }, [tab, syncAdvancedFromVisual]);

  function updateNewColumn(index: number, patch: Partial<VisualColumn>): void {
    setNewColumns((current) =>
      current.map((column, columnIndex) =>
        columnIndex === index ? { ...column, ...patch } : column,
      ),
    );
  }

  function removeNewColumn(index: number): void {
    setNewColumns((current) =>
      current.length <= 1 ? current : current.filter((_, columnIndex) => columnIndex !== index),
    );
  }

  function toggleDrop(columnName: string): void {
    setDropColumns((current) => {
      const next = new Set(current);
      if (next.has(columnName)) {
        next.delete(columnName);
      } else {
        next.add(columnName);
      }
      return next;
    });
  }

  function switchToAdvanced(): void {
    syncAdvancedFromVisual();
    setTab("advanced");
  }

  function switchToVisual(): void {
    const parsed = parseJsonSchemaText(advancedText);
    if (parsed.schema) {
      const addEntries = Array.isArray(parsed.schema.add)
        ? parsed.schema.add
        : [];
      const visualAdd = addEntries
        .filter(
          (entry): entry is { name: string; schema: unknown } =>
            entry !== null &&
            typeof entry === "object" &&
            typeof (entry as { name?: unknown }).name === "string",
        )
        .map((entry) => {
          const property =
            entry.schema !== null && typeof entry.schema === "object"
              ? (entry.schema as Record<string, unknown>)
              : {};
          const typeValue = property.type;
          const typeName = Array.isArray(typeValue) ? typeValue[0] : typeValue;
          return {
            name: entry.name,
            type:
              typeName === "integer" ||
              typeName === "number" ||
              typeName === "boolean"
                ? typeName
                : "string",
            required: false,
          } satisfies VisualColumn;
        });
      setNewColumns(visualAdd.length > 0 ? visualAdd : [emptyVisualColumn()]);
      const dropEntries = Array.isArray(parsed.schema.drop)
        ? parsed.schema.drop.filter((entry): entry is string => typeof entry === "string")
        : [];
      setDropColumns(new Set(dropEntries));
    }
    setTab("visual");
  }

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    setError(null);

    let add: Array<{ name: string; schema: unknown }> | undefined;
    let drop: string[] | undefined;

    if (tab === "advanced") {
      const parsed = parseJsonSchemaText(advancedText);
      if (!parsed.schema) {
        setError(parsed.error ?? "Invalid JSON");
        return;
      }
      if (Array.isArray(parsed.schema.add)) {
        add = parsed.schema.add as Array<{ name: string; schema: unknown }>;
      }
      if (Array.isArray(parsed.schema.drop)) {
        drop = parsed.schema.drop.filter(
          (entry): entry is string => typeof entry === "string",
        );
      }
    } else {
      const additions = newColumns
        .map((column) => ({ ...column, name: column.name.trim() }))
        .filter((column) => column.name.length > 0);
      for (const column of additions) {
        if (existingNames.has(column.name)) {
          setError(`Column "${column.name}" already exists`);
          return;
        }
      }
      if (additions.length > 0) {
        add = additions.map((column) => ({
          name: column.name,
          schema: { type: column.type },
        }));
      }
      if (dropColumns.size > 0) {
        drop = [...dropColumns];
      }
    }

    if ((!add || add.length === 0) && (!drop || drop.length === 0)) {
      setError("Add or drop at least one column");
      return;
    }

    if (
      drop &&
      drop.includes("id")
    ) {
      setError('Cannot drop column "id"');
      return;
    }

    setSubmitting(true);
    try {
      await alterTable({
        table: table.name,
        add,
        drop,
      });
      onSaved();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to alter table",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const droppableColumns = table.columns.filter((column) => column.name !== "id");

  return (
    <div class="form-panel v-card">
      <div class="form-panel__header">
        <h2>Edit schema: {table.name}</h2>
        <button type="button" class="v-button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <form class="form-panel__body" onSubmit={(event) => void handleSubmit(event)}>
        <div class="v-tabs">
          <div class="v-tab-bar" role="tablist">
            <button
              type="button"
              role="tab"
              class={`v-tab${tab === "visual" ? " active" : ""}`}
              aria-selected={tab === "visual"}
              onClick={() => (tab === "advanced" ? switchToVisual() : setTab("visual"))}
            >
              Visual
            </button>
            <button
              type="button"
              role="tab"
              class={`v-tab${tab === "advanced" ? " active" : ""}`}
              aria-selected={tab === "advanced"}
              onClick={() => (tab === "visual" ? switchToAdvanced() : setTab("advanced"))}
            >
              Advanced JSON
            </button>
          </div>
        </div>

        {tab === "visual" ? (
          <>
            <section class="column-editor-section">
              <h3>Existing columns</h3>
              {droppableColumns.length === 0 ? (
                <div class="v-empty-state">No droppable columns.</div>
              ) : (
                <ul class="existing-columns">
                  {droppableColumns.map((column) => (
                    <li key={column.name}>
                      <span>
                        {column.name}{" "}
                        <span class="v-badge">{column.sqlType.toLowerCase()}</span>
                      </span>
                      <label>
                        <input
                          type="checkbox"
                          checked={dropColumns.has(column.name)}
                          onChange={() => toggleDrop(column.name)}
                        />
                        Drop
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section class="column-editor-section">
              <h3>Add columns</h3>
              <div class="column-editor">
                {newColumns.map((column, index) => (
                  <div class="column-editor__row" key={index}>
                    <input
                      type="text"
                      value={column.name}
                      placeholder="new_column"
                      onInput={(event) =>
                        updateNewColumn(index, {
                          name: (event.target as HTMLInputElement).value,
                        })
                      }
                    />
                    <select
                      value={column.type}
                      onChange={(event) =>
                        updateNewColumn(index, {
                          type: (event.target as HTMLSelectElement)
                            .value as VisualColumnType,
                        })
                      }
                    >
                      {COLUMN_TYPES.map((columnType) => (
                        <option key={columnType} value={columnType}>
                          {columnType}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      class="v-button secondary"
                      disabled={newColumns.length <= 1}
                      onClick={() => removeNewColumn(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  class="v-button secondary"
                  onClick={() =>
                    setNewColumns((current) => [...current, emptyVisualColumn()])
                  }
                >
                  Add column
                </button>
              </div>
            </section>
          </>
        ) : (
          <label class="form-field form-field--stacked">
            <span>Alter payload</span>
            <textarea
              rows={12}
              value={advancedText}
              onInput={(event) =>
                setAdvancedText((event.target as HTMLTextAreaElement).value)
              }
            />
          </label>
        )}

        {error ? <div class="app-message app-message--error">{error}</div> : null}

        <div class="form-panel__actions">
          <button
            type="submit"
            class="v-button"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
