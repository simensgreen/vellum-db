import type { TableSummary } from "../api.ts";
import { HomeIcon } from "./HomeIcon.tsx";

export function TableListPanel({
  tables,
  selectedTable,
  overviewSelected,
  listLoading,
  listError,
  onSelectOverview,
  onSelectTable,
  onNewTable,
}: {
  tables: TableSummary[];
  selectedTable: string | null;
  overviewSelected: boolean;
  listLoading: boolean;
  listError: string | null;
  onSelectOverview: () => void;
  onSelectTable: (tableName: string) => void;
  onNewTable: () => void;
}) {
  return (
    <aside class="app-shell__sidebar v-card">
      <div class="app-shell__sidebar-header">
        <div class="app-shell__sidebar-title">
          <button
            type="button"
            class={`v-button ghost app-shell__home-btn${overviewSelected ? " app-shell__home-btn--selected" : ""}`}
            onClick={onSelectOverview}
            aria-label="Overview"
            aria-current={overviewSelected ? "page" : undefined}
          >
            <HomeIcon />
          </button>
          <h1 class="app-shell__title">Database</h1>
        </div>
        <button type="button" class="v-button" onClick={onNewTable}>
          New table
        </button>
      </div>
      {listLoading ? <div class="v-empty-state">Loading…</div> : null}
      {listError ? <div class="app-message app-message--error">{listError}</div> : null}
      <ul class="v-list table-list">
        {!listLoading && tables.length === 0 ? (
          <li>
            <div class="v-empty-state table-list__empty-hint">No tables yet.</div>
          </li>
        ) : null}
        {tables.map((table) => (
          <li key={table.name}>
            <button
              type="button"
              class={`v-list-item table-list__item${selectedTable === table.name ? " table-list__item--selected" : ""}`}
              onClick={() => onSelectTable(table.name)}
            >
              <span class="table-list__name">{table.definition.name}</span>
              {table.scope ? (
                <span class="v-badge table-list__scope">{table.scope}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
