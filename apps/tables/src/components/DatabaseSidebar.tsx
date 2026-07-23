import type { TableSummary, ViewSummary } from "../api.ts";
import { HomeIcon } from "./HomeIcon.tsx";
import { ScopeAccordionList } from "./ScopeAccordionList.tsx";

export type SidebarTab = "tables" | "views";

export function DatabaseSidebar({
  sidebarTab,
  onSidebarTabChange,
  tables,
  views,
  selectedTable,
  selectedView,
  overviewSelected,
  tablesLoading,
  viewsLoading,
  tablesError,
  viewsError,
  onSelectOverview,
  onSelectTable,
  onSelectView,
  onNewTable,
}: {
  sidebarTab: SidebarTab;
  onSidebarTabChange: (tab: SidebarTab) => void;
  tables: TableSummary[];
  views: ViewSummary[];
  selectedTable: string | null;
  selectedView: string | null;
  overviewSelected: boolean;
  tablesLoading: boolean;
  viewsLoading: boolean;
  tablesError: string | null;
  viewsError: string | null;
  onSelectOverview: () => void;
  onSelectTable: (tableName: string) => void;
  onSelectView: (viewSlug: string) => void;
  onNewTable: () => void;
}) {
  const listLoading = sidebarTab === "tables" ? tablesLoading : viewsLoading;
  const listError = sidebarTab === "tables" ? tablesError : viewsError;

  function handleTabChange(tab: SidebarTab): void {
    onSidebarTabChange(tab);
  }

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
        <div class="v-tabs sidebar-tabs">
          <div class="v-tab-bar sidebar-tabs__bar" role="tablist">
            <button
              type="button"
              role="tab"
              class={`v-tab sidebar-tabs__tab${sidebarTab === "tables" ? " active" : ""}`}
              aria-selected={sidebarTab === "tables"}
              onClick={() => handleTabChange("tables")}
            >
              Tables
            </button>
            <button
              type="button"
              role="tab"
              class={`v-tab sidebar-tabs__tab${sidebarTab === "views" ? " active" : ""}`}
              aria-selected={sidebarTab === "views"}
              onClick={() => handleTabChange("views")}
            >
              Views
            </button>
          </div>
        </div>
        {sidebarTab === "tables" ? (
          <button type="button" class="v-button" onClick={onNewTable}>
            New table
          </button>
        ) : null}
      </div>
      {listLoading ? <div class="v-empty-state">Loading…</div> : null}
      {listError ? (
        <div class="app-message app-message--error">{listError}</div>
      ) : null}
      {!listLoading && !listError ? (
        <>
          <div hidden={sidebarTab !== "tables"}>
            <ScopeAccordionList
              items={tables}
              selectedKey={selectedTable}
              getKey={(table) => table.name}
              getLabel={(table) => table.definition.name}
              onSelect={onSelectTable}
              emptyMessage="No tables yet."
            />
          </div>
          <div hidden={sidebarTab !== "views"}>
            <ScopeAccordionList
              items={views}
              selectedKey={selectedView}
              getKey={(view) => view.slug}
              getLabel={(view) => view.name}
              onSelect={onSelectView}
              emptyMessage="No views yet."
            />
          </div>
        </>
      ) : null}
    </aside>
  );
}
