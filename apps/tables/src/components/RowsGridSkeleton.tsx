import { useMemo } from "preact/hooks";
import type { TableSummary } from "../api.ts";
import { visibleColumns } from "../row-editor.ts";

const SKELETON_ROW_COUNT = 8;
const SKELETON_CELL_WIDTHS = ["55%", "70%", "45%"] as const;

export function RowsGridSkeleton({ table }: { table: TableSummary }) {
  const displayColumns = useMemo(() => visibleColumns(table), [table]);
  const tableTitle = table.definition.name;

  return (
    <div
      class="rows-grid rows-grid--loading"
      aria-busy="true"
      aria-label="Loading table rows"
    >
      <div class="rows-grid__sticky-bar">
        <div class="rows-grid__header">
          <div class="rows-grid__header-main">
            <h2 class="rows-grid__title">{tableTitle}</h2>
            <span class="skeleton skeleton--badge" aria-hidden="true" />
          </div>
          <div class="rows-grid__header-actions">
            <span class="skeleton skeleton--icon-btn" aria-hidden="true" />
            <span class="skeleton skeleton--icon-btn" aria-hidden="true" />
          </div>
        </div>

        <div class="rows-grid__toolbar-row">
          <div class="rows-grid__pager">
            <span class="skeleton skeleton--pager-btn" aria-hidden="true" />
            <span class="skeleton skeleton--range" aria-hidden="true" />
            <span class="skeleton skeleton--limit" aria-hidden="true" />
            <span class="skeleton skeleton--pager-btn" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div class="rows-grid__scroll">
        <table class="v-data-table rows-grid__table">
          <thead>
            <tr class="rows-grid__header-row">
              <th class="rows-grid__select-col" aria-hidden="true" />
              {displayColumns.map((column) => (
                <th key={column.slug}>{column.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
              <tr key={rowIndex} class="rows-grid__row rows-grid__row--skeleton">
                <td class="rows-grid__select-col">
                  <span
                    class="skeleton skeleton--cell skeleton--cell-action"
                    aria-hidden="true"
                  />
                </td>
                {displayColumns.map((column, columnIndex) => (
                  <td key={column.slug} class="rows-grid__cell">
                    <span
                      class="skeleton skeleton--cell"
                      style={{
                        width:
                          SKELETON_CELL_WIDTHS[
                            (rowIndex + columnIndex) % SKELETON_CELL_WIDTHS.length
                          ],
                      }}
                      aria-hidden="true"
                    />
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
