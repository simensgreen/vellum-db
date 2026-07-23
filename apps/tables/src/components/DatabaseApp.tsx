import { useCallback, useEffect, useState } from "preact/hooks";
import {
  fetchRows,
  fetchTables,
  type RowsResponse,
  type TableSummary,
} from "../api.ts";
import { vellumSubscribe } from "../platform/bridge.ts";
import {
  SYNC_TAGS,
  subscribeTagsForRowView,
  subscribeTagsForTableList,
  tableNameFromDataTag,
} from "../sync-tags.ts";
import { AppShell } from "./AppShell.tsx";
import { CreateTableForm } from "./CreateTableForm.tsx";
import { EditTableForm } from "./EditTableForm.tsx";
import { PAGE_SIZE } from "./RowsGrid.tsx";
import { TableDetailView } from "./TableDetailView.tsx";
import { TableListPanel } from "./TableListPanel.tsx";

type MainView = "rows" | "create" | "edit";

export function DatabaseApp() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rowsState, setRowsState] = useState<RowsResponse | null>(null);
  const [rowOffset, setRowOffset] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [mainView, setMainView] = useState<MainView>("rows");

  const selectedSummary =
    tables.find((table) => table.name === selectedTable) ?? null;

  const loadTables = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await fetchTables();
      setTables(response.tables);
      if (response.tables.length > 0) {
        setSelectedTable((current) => {
          if (current && response.tables.some((table) => table.name === current)) {
            return current;
          }
          return response.tables[0]!.name;
        });
      } else {
        setSelectedTable(null);
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Failed to load tables");
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadRows = useCallback(async (tableName: string, offset: number) => {
    setRowsError(null);
    setRowsState(null);
    try {
      const response = await fetchRows(tableName, offset, PAGE_SIZE);
      setRowsState(response);
    } catch (error) {
      setRowsError(error instanceof Error ? error.message : "Failed to load rows");
    }
  }, []);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (!selectedTable || mainView !== "rows") {
      return;
    }
    void loadRows(selectedTable, rowOffset);
  }, [selectedTable, rowOffset, loadRows, mainView]);

  useEffect(() => {
    const unsubscribeList = vellumSubscribe(
      { tags: subscribeTagsForTableList() },
      () => {
        void loadTables();
      },
    );
    return unsubscribeList ?? undefined;
  }, [loadTables]);

  useEffect(() => {
    if (!selectedTable) {
      return;
    }
    const unsubscribeRows = vellumSubscribe(
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
    return unsubscribeRows ?? undefined;
  }, [selectedTable, rowOffset, loadTables, loadRows]);

  function handleSelectTable(tableName: string): void {
    setSelectedTable(tableName);
    setRowOffset(0);
    setMainView("rows");
  }

  function handleTableCreated(tableName: string): void {
    void loadTables().then(() => {
      setSelectedTable(tableName);
      setRowOffset(0);
      setMainView("rows");
    });
  }

  function handleSchemaSaved(): void {
    void loadTables().then(() => {
      setMainView("rows");
      if (selectedTable) {
        void loadRows(selectedTable, rowOffset);
      }
    });
  }

  let mainContent;
  if (mainView === "create") {
    mainContent = (
      <CreateTableForm
        onCancel={() => setMainView("rows")}
        onCreated={handleTableCreated}
      />
    );
  } else if (mainView === "edit" && selectedSummary) {
    mainContent = (
      <EditTableForm
        table={selectedSummary}
        onCancel={() => setMainView("rows")}
        onSaved={handleSchemaSaved}
      />
    );
  } else if (!selectedTable) {
    mainContent = <div class="v-empty-state">Select a table to view rows.</div>;
  } else {
    mainContent = (
      <TableDetailView
        tableName={selectedTable}
        rowsState={rowsState}
        rowsError={rowsError}
        onPageChange={setRowOffset}
        onEditSchema={() => setMainView("edit")}
      />
    );
  }

  return (
    <AppShell
      sidebar={
        <TableListPanel
          tables={tables}
          selectedTable={selectedTable}
          listLoading={listLoading}
          listError={listError}
          onSelectTable={handleSelectTable}
          onNewTable={() => setMainView("create")}
        />
      }
      main={mainContent}
    />
  );
}
