import type { RowsResponse, TableSummary } from "../api.ts"
import { RowsGrid } from "./RowsGrid.tsx"

export function TableDetailView({
    table,
    rowsState,
    rowsError,
    rowLimit,
    onOffsetChange,
    onLimitChange,
    onApplySuccess
}: {
    table: TableSummary
    rowsState: RowsResponse | null
    rowsError: string | null
    rowLimit: number
    onOffsetChange: (offset: number) => void
    onLimitChange: (limit: number) => void
    onApplySuccess?: () => void
}) {
    return (
        <div class="table-detail">
            {rowsError ? (
                <div class="app-message app-message--error">{rowsError}</div>
            ) : (
                <RowsGrid
                    table={table}
                    rowsState={rowsState}
                    limit={rowLimit}
                    onOffsetChange={onOffsetChange}
                    onLimitChange={onLimitChange}
                    onApplySuccess={onApplySuccess}
                />
            )}
        </div>
    )
}
