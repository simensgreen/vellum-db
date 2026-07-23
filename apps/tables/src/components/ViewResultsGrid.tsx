import { ChevronLeftIcon, ChevronRightIcon } from "./ChevronIcons.tsx";

function ViewResultsSkeleton() {
  return (
    <div class="view-results-grid view-results-grid--loading" aria-busy="true">
      <div class="view-results-grid__scroll">
        <table class="v-data-table view-results-grid__table">
          <thead>
            <tr>
              {["A", "B", "C", "D"].map((column) => (
                <th key={column}>
                  <span class="skeleton skeleton--cell" aria-hidden="true" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: 4 }, (_, columnIndex) => (
                  <td key={columnIndex}>
                    <span class="skeleton skeleton--cell" aria-hidden="true" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatRowRange(
  offset: number,
  limit: number,
  count: number,
  totalCount?: number,
): string {
  if (count === 0) {
    return "0 rows";
  }
  const rangeEnd = Math.min(offset + limit, count + offset);
  const totalLabel =
    totalCount !== undefined ? formatCount(totalCount) : formatCount(count);
  return `${formatCount(offset)}–${formatCount(rangeEnd)} of ${totalLabel}`;
}

export function ViewResultsGrid({
  rows,
  count,
  totalCount,
  limit,
  offset,
  hasMore,
  loading,
  onOffsetChange,
}: {
  rows: Record<string, unknown>[] | null;
  count: number;
  totalCount?: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  loading: boolean;
  onOffsetChange: (offset: number) => void;
}) {
  if (loading && rows === null) {
    return <ViewResultsSkeleton />;
  }

  const columns =
    rows && rows.length > 0
      ? Object.keys(rows[0] ?? {})
      : rows !== null
        ? []
        : [];

  return (
    <div class="view-results-grid">
      <div class="view-results-grid__pager rows-grid__pager">
        <button
          type="button"
          class="v-button secondary rows-grid__pager-btn"
          disabled={offset <= 0}
          aria-label="Previous rows"
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeftIcon />
        </button>
        <span class="rows-grid__range">
          {formatRowRange(offset, limit, count, totalCount)}
        </span>
        <button
          type="button"
          class="v-button secondary rows-grid__pager-btn"
          disabled={!hasMore}
          aria-label="Next rows"
          onClick={() => onOffsetChange(offset + limit)}
        >
          <ChevronRightIcon />
        </button>
      </div>
      {rows !== null && rows.length === 0 ? (
        <div class="v-empty-state">No rows returned.</div>
      ) : null}
      {rows !== null && rows.length > 0 ? (
        <div class="view-results-grid__scroll">
          <table class="v-data-table view-results-grid__table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column}>{formatCellValue(row[column])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
