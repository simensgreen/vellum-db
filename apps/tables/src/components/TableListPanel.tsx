import type { TableSummary } from "../api.ts";

export function TableListPanel({
  tables,
  selectedTable,
  listLoading,
  listError,
  onSelectTable,
  onNewTable,
}: {
  tables: TableSummary[];
  selectedTable: string | null;
  listLoading: boolean;
  listError: string | null;
  onSelectTable: (tableName: string) => void;
  onNewTable: () => void;
}) {
  return (
    <aside class="app-shell__sidebar v-card">
      <div class="app-shell__sidebar-header">
        <h1 class="app-shell__title">Database</h1>
        <button type="button" class="v-button" onClick={onNewTable}>
          New table
        </button>
      </div>
      {listLoading ? <div class="v-empty-state">Loading…</div> : null}
      {listError ? <div class="app-message app-message--error">{listError}</div> : null}
      {!listLoading && tables.length === 0 ? (
        <div class="v-empty-state">No tables yet.</div>
      ) : (
        <ul class="v-list table-list">
          {tables.map((table) => (
            <li key={table.name}>
              <button
                type="button"
                class={`v-list-item table-list__item${selectedTable === table.name ? " table-list__item--selected" : ""}`}
                onClick={() => onSelectTable(table.name)}
              >
                <span class="table-list__name">{table.name}</span>
                {table.scope ? (
                  <span class="v-badge table-list__scope">{table.scope}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
