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

export function RowsGrid({
  tableName,
  rowsState,
  onPageChange,
}: {
  tableName: string;
  rowsState: import("../api.ts").RowsResponse | null;
  onPageChange: (offset: number) => void;
}) {
  if (!rowsState) {
    return <div class="v-empty-state">Loading rows…</div>;
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
    <div class="rows-grid">
      <div class="rows-grid__toolbar">
        <strong>{tableName}</strong>
        <span class="v-badge">
          {rowsState.count} row{rowsState.count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          class="v-button secondary"
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
          class="v-button secondary"
          disabled={!rowsState.has_more}
          onClick={() => onPageChange(rowsState.offset + PAGE_SIZE)}
        >
          Next
        </button>
      </div>
      {rowsState.rows.length === 0 ? (
        <div class="v-empty-state">No rows in this table.</div>
      ) : (
        <div class="rows-grid__scroll">
          <table class="v-data-table">
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
        </div>
      )}
    </div>
  );
}

export { PAGE_SIZE };
