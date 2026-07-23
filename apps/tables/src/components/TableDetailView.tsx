import { RowsGrid } from "./RowsGrid.tsx";

export function TableDetailView({
  tableName,
  rowsState,
  rowsError,
  onPageChange,
  onEditSchema,
}: {
  tableName: string;
  rowsState: import("../api.ts").RowsResponse | null;
  rowsError: string | null;
  onPageChange: (offset: number) => void;
  onEditSchema: () => void;
}) {
  return (
    <div class="table-detail">
      <div class="table-detail__toolbar">
        <button type="button" class="v-button secondary" onClick={onEditSchema}>
          Edit schema
        </button>
      </div>
      {rowsError ? (
        <div class="app-message app-message--error">{rowsError}</div>
      ) : (
        <RowsGrid
          tableName={tableName}
          rowsState={rowsState}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
