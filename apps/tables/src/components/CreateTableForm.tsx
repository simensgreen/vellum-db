import { useCallback, useEffect, useState } from "preact/hooks";
import { createTable } from "../api.ts";
import {
  emptyVisualColumn,
  jsonSchemaToVisual,
  parseJsonSchemaText,
  validateScope,
  validateTableName,
  visualToJsonSchema,
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

export function CreateTableForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (tableName: string) => void;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [tab, setTab] = useState<TabId>("visual");
  const [columns, setColumns] = useState<VisualColumn[]>([emptyVisualColumn()]);
  const [advancedText, setAdvancedText] = useState(
    JSON.stringify(visualToJsonSchema([emptyVisualColumn()]), null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const syncAdvancedFromVisual = useCallback((nextColumns: VisualColumn[]) => {
    setAdvancedText(JSON.stringify(visualToJsonSchema(nextColumns), null, 2));
  }, []);

  useEffect(() => {
    if (tab === "visual") {
      syncAdvancedFromVisual(columns);
    }
  }, [tab, columns, syncAdvancedFromVisual]);

  function updateColumn(index: number, patch: Partial<VisualColumn>): void {
    setColumns((current) =>
      current.map((column, columnIndex) =>
        columnIndex === index ? { ...column, ...patch } : column,
      ),
    );
  }

  function removeColumn(index: number): void {
    setColumns((current) =>
      current.length <= 1 ? current : current.filter((_, columnIndex) => columnIndex !== index),
    );
  }

  function switchToAdvanced(): void {
    syncAdvancedFromVisual(columns);
    setTab("advanced");
  }

  function switchToVisual(): void {
    const parsed = parseJsonSchemaText(advancedText);
    if (parsed.schema) {
      setColumns(jsonSchemaToVisual(parsed.schema));
    }
    setTab("visual");
  }

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    setError(null);

    const nameError = validateTableName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    const scopeError = validateScope(scope);
    if (scopeError) {
      setError(scopeError);
      return;
    }

    let schema: Record<string, unknown>;
    if (tab === "advanced") {
      const parsed = parseJsonSchemaText(advancedText);
      if (!parsed.schema) {
        setError(parsed.error ?? "Invalid schema");
        return;
      }
      schema = parsed.schema;
    } else {
      const nonEmpty = columns.filter((column) => column.name.trim());
      if (nonEmpty.length === 0) {
        setError("Add at least one column");
        return;
      }
      schema = visualToJsonSchema(nonEmpty);
    }

    setSubmitting(true);
    try {
      await createTable({
        name: name.trim(),
        scope: scope.trim() || undefined,
        schema,
      });
      onCreated(name.trim());
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
          <span>Name</span>
          <input
            type="text"
            value={name}
            onInput={(event) => setName((event.target as HTMLInputElement).value)}
            placeholder="my_table"
            required
          />
        </label>

        <label class="form-field">
          <span>Scope (optional)</span>
          <input
            type="text"
            value={scope}
            onInput={(event) => setScope((event.target as HTMLInputElement).value)}
            placeholder="finance"
          />
        </label>

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
          <div class="column-editor">
            {columns.map((column, index) => (
              <div class="column-editor__row" key={index}>
                <input
                  type="text"
                  value={column.name}
                  placeholder="column_name"
                  onInput={(event) =>
                    updateColumn(index, {
                      name: (event.target as HTMLInputElement).value,
                    })
                  }
                />
                <select
                  value={column.type}
                  onChange={(event) =>
                    updateColumn(index, {
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
                <label class="column-editor__required">
                  <input
                    type="checkbox"
                    checked={column.required}
                    onChange={(event) =>
                      updateColumn(index, {
                        required: (event.target as HTMLInputElement).checked,
                      })
                    }
                  />
                  Required
                </label>
                <button
                  type="button"
                  class="v-button secondary"
                  disabled={columns.length <= 1}
                  onClick={() => removeColumn(index)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              class="v-button secondary"
              onClick={() => setColumns((current) => [...current, emptyVisualColumn()])}
            >
              Add column
            </button>
          </div>
        ) : (
          <label class="form-field form-field--stacked">
            <span>JSON Schema</span>
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
            {submitting ? "Creating…" : "Create table"}
          </button>
        </div>
      </form>
    </div>
  );
}
