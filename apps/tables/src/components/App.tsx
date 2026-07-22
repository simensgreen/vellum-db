import { useCallback, useEffect, useState } from "preact/hooks";
import {
  fetchRows,
  fetchTables,
  type RowsResponse,
  type TableSummary,
} from "../api.ts";
import {
  SYNC_TAGS,
  subscribeTagsForRowView,
  subscribeTagsForTableList,
  tableNameFromDataTag,
} from "../sync-tags.ts";

const PAGE_SIZE = 50;

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function DataGrid({
  tableName,
  rowsState,
  onPageChange,
}: {
  tableName: string;
  rowsState: RowsResponse | null;
  onPageChange: (offset: number) => void;
}) {
  if (!rowsState) {
    return <div class="status">Loading rows…</div>;
  }

  const columnNames = new Set<string>(["id"]);
  for (const row of rowsState.rows) {
    for (const key of Object.keys(row)) {
      columnNames.add(key);
    }
  }
  const columns = [...columnNames];

  const pageIndex = Math.floor(rowsState.offset / PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(rowsState.count / PAGE_SIZE));

  return (
    <div>
      <div class="toolbar">
        <strong>{tableName}</strong>
        <span>
          {rowsState.count} row{rowsState.count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          disabled={rowsState.offset <= 0}
          onClick={() => onPageChange(Math.max(0, rowsState.offset - PAGE_SIZE))}
        >
          Previous
        </button>
        <span>
          Page {pageIndex + 1} / {pageCount}
        </span>
        <button
          type="button"
          disabled={!rowsState.has_more}
          onClick={() => onPageChange(rowsState.offset + PAGE_SIZE)}
        >
          Next
        </button>
      </div>
      {rowsState.rows.length === 0 ? (
        <div class="status">No rows in this table.</div>
      ) : (
        <table class="data-grid">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsState.rows.map((row) => (
              <tr key={String(row.id ?? JSON.stringify(row))}>
                {columns.map((column) => {
                  const cell = row[column];
                  const isJson =
                    cell !== null && typeof cell === "object";
                  return (
                    <td key={column}>
                      {isJson ? (
                        <span class="cell-json">{formatCell(cell)}</span>
                      ) : (
                        formatCell(cell)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function App() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rowsState, setRowsState] = useState<RowsResponse | null>(null);
  const [rowOffset, setRowOffset] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const loadTables = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await fetchTables();
      setTables(response.tables);
      if (response.tables.length > 0) {
        setSelectedTable((current) => current ?? response.tables[0]!.name);
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Failed to load tables");
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadRows = useCallback(
    async (tableName: string, offset: number) => {
      setRowsError(null);
      setRowsState(null);
      try {
        const response = await fetchRows(tableName, offset, PAGE_SIZE);
        setRowsState(response);
      } catch (error) {
        setRowsError(error instanceof Error ? error.message : "Failed to load rows");
      }
    },
    [],
  );

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (!selectedTable) {
      setRowsState(null);
      return;
    }
    void loadRows(selectedTable, rowOffset);
  }, [selectedTable, rowOffset, loadRows]);

  useEffect(() => {
    if (!window.vellum?.subscribe) {
      return;
    }
    const unsubscribeList = window.vellum.subscribe(
      { tags: subscribeTagsForTableList() },
      () => {
        void loadTables();
      },
    );
    return unsubscribeList;
  }, [loadTables]);

  useEffect(() => {
    if (!selectedTable || !window.vellum?.subscribe) {
      return;
    }
    const unsubscribeRows = window.vellum.subscribe(
      { tags: subscribeTagsForRowView(selectedTable) },
      (event) => {
        const matchedTags = event.tags ?? [];
        const reloadList = matchedTags.includes(SYNC_TAGS.tables);
        const rowTableNames = matchedTags
          .map((tag) => tableNameFromDataTag(tag))
          .filter((name): name is string => name !== null);
        if (reloadList) {
          void loadTables();
        }
        if (rowTableNames.includes(selectedTable)) {
          void loadRows(selectedTable, rowOffset);
        }
      },
    );
    return unsubscribeRows;
  }, [selectedTable, rowOffset, loadTables, loadRows]);

  return (
    <div class="layout">
      <aside class="panel">
        <h1>Tables</h1>
        {listLoading ? <div class="status">Loading…</div> : null}
        {listError ? <div class="status error">{listError}</div> : null}
        {!listLoading && tables.length === 0 ? (
          <div class="status">No tables yet.</div>
        ) : (
          <ul class="table-list">
            {tables.map((table) => (
              <li key={table.name}>
                <button
                  type="button"
                  class={selectedTable === table.name ? "active" : undefined}
                  onClick={() => {
                    setSelectedTable(table.name);
                    setRowOffset(0);
                  }}
                >
                  {table.name}
                  {table.scope ? ` (${table.scope})` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <main class="content">
        {!selectedTable ? (
          <div class="status">Select a table to view rows.</div>
        ) : rowsError ? (
          <div class="status error">{rowsError}</div>
        ) : (
          <DataGrid
            tableName={selectedTable}
            rowsState={rowsState}
            onPageChange={setRowOffset}
          />
        )}
      </main>
    </div>
  );
}
