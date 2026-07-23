import type { RefOnDelete, RefOnUpdate } from "vellum-db/core/table/types";
import type { RefTarget } from "../table-definition-editor/types.ts";

export function RefColumnFields({
  table,
  column,
  onDelete,
  onUpdate,
  refTargets,
  onChange,
}: {
  table: string;
  column: string;
  onDelete?: RefOnDelete;
  onUpdate?: RefOnUpdate;
  refTargets: RefTarget[];
  onChange: (patch: {
    table?: string;
    column?: string;
    onDelete?: RefOnDelete;
    onUpdate?: RefOnUpdate;
  }) => void;
}) {
  const selectedTarget = refTargets.find((target) => target.tableSlug === table);
  const pkOptions = selectedTarget?.pkColumns ?? [];

  return (
    <div class="ref-column-fields">
      <label class="form-field">
        <span>Referenced table</span>
        <select
          value={table}
          onChange={(event) => {
            const nextTable = (event.target as HTMLSelectElement).value;
            const target = refTargets.find(
              (entry) => entry.tableSlug === nextTable,
            );
            onChange({
              table: nextTable,
              column: target?.pkColumns[0] ?? "",
            });
          }}
        >
          <option value="">Select table…</option>
          {refTargets.map((target) => (
            <option key={target.tableSlug} value={target.tableSlug}>
              {target.label} ({target.tableSlug})
            </option>
          ))}
        </select>
      </label>

      <label class="form-field">
        <span>Referenced PK column</span>
        <select
          value={column}
          disabled={pkOptions.length === 0}
          onChange={(event) =>
            onChange({ column: (event.target as HTMLSelectElement).value })
          }
        >
          <option value="">Select column…</option>
          {pkOptions.map((pkColumn) => (
            <option key={pkColumn} value={pkColumn}>
              {pkColumn}
            </option>
          ))}
        </select>
      </label>

      <label class="form-field">
        <span>On delete</span>
        <select
          value={onDelete ?? "restrict"}
          onChange={(event) =>
            onChange({
              onDelete: (event.target as HTMLSelectElement)
                .value as RefOnDelete,
            })
          }
        >
          <option value="restrict">restrict</option>
          <option value="cascade">cascade</option>
          <option value="set null">set null</option>
        </select>
      </label>

      <label class="form-field">
        <span>On update</span>
        <select
          value={onUpdate ?? "restrict"}
          onChange={(event) =>
            onChange({
              onUpdate: (event.target as HTMLSelectElement)
                .value as RefOnUpdate,
            })
          }
        >
          <option value="restrict">restrict</option>
          <option value="cascade">cascade</option>
        </select>
      </label>
    </div>
  );
}
