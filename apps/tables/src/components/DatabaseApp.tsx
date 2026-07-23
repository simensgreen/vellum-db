import type { ComponentChild } from "preact"
import { useCallback, useEffect, useState } from "preact/hooks"
import {
    fetchRows,
    fetchTables,
    fetchViews,
    type RowsResponse,
    runView,
    type TableSummary,
    type ViewRunResponse,
    type ViewSummary
} from "../api.ts"
import { vellumSubscribe } from "../platform/bridge.ts"
import {
    SYNC_TAGS,
    subscribeTagsForRowView,
    subscribeTagsForTableList,
    subscribeTagsForViewList,
    tableNameFromDataTag
} from "../sync-tags.ts"
import { AppShell } from "./AppShell.tsx"
import { CreateTableForm } from "./CreateTableForm.tsx"
import { DashboardView } from "./DashboardView.tsx"
import { DatabaseSidebar, type SidebarTab } from "./DatabaseSidebar.tsx"
import { EditTableForm } from "./EditTableForm.tsx"
import { DEFAULT_ROW_LIMIT } from "./RowsGrid.tsx"
import { TableDetailView } from "./TableDetailView.tsx"
import { ViewDetailView } from "./ViewDetailView.tsx"

type MainView = "rows" | "create" | "edit"

function emptyParamValues(paramNames: string[]): Record<string, string> {
    const values: Record<string, string> = {}
    for (const paramName of paramNames) {
        values[paramName] = ""
    }
    return values
}

function paramsFromForm(
    paramNames: string[],
    values: Record<string, string>
): Record<string, unknown> {
    const params: Record<string, unknown> = {}
    for (const paramName of paramNames) {
        const raw = values[paramName] ?? ""
        if (raw === "") {
            continue
        }
        params[paramName] = raw
    }
    return params
}

export function DatabaseApp() {
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>("tables")
    const [tables, setTables] = useState<TableSummary[]>([])
    const [views, setViews] = useState<ViewSummary[]>([])
    const [selectedTable, setSelectedTable] = useState<string | null>(null)
    const [selectedView, setSelectedView] = useState<string | null>(null)
    const [rowsState, setRowsState] = useState<RowsResponse | null>(null)
    const [rowOffset, setRowOffset] = useState(0)
    const [rowLimit, setRowLimit] = useState(DEFAULT_ROW_LIMIT)
    const [tablesError, setTablesError] = useState<string | null>(null)
    const [viewsError, setViewsError] = useState<string | null>(null)
    const [rowsError, setRowsError] = useState<string | null>(null)
    const [tablesLoading, setTablesLoading] = useState(true)
    const [viewsLoading, setViewsLoading] = useState(true)
    const [mainView, setMainView] = useState<MainView>("rows")
    const [statsRefreshKey, setStatsRefreshKey] = useState(0)
    const [viewParams, setViewParams] = useState<Record<string, string>>({})
    const [viewRunState, setViewRunState] = useState<ViewRunResponse | null>(null)
    const [viewRunError, setViewRunError] = useState<string | null>(null)
    const [viewRunLoading, setViewRunLoading] = useState(false)

    const selectedTableSummary = tables.find((table) => table.name === selectedTable) ?? null
    const selectedViewSummary = views.find((view) => view.slug === selectedView) ?? null
    const selectedViewParamNames = selectedViewSummary?.param_names ?? []

    const loadTables = useCallback(async () => {
        setTablesLoading(true)
        setTablesError(null)
        try {
            const response = await fetchTables()
            setTables(response.tables)
            setSelectedTable((current) => {
                if (!current) {
                    return null
                }
                if (response.tables.some((table) => table.name === current)) {
                    return current
                }
                return null
            })
            setStatsRefreshKey((key) => key + 1)
        } catch (error) {
            setTablesError(error instanceof Error ? error.message : "Failed to load tables")
        } finally {
            setTablesLoading(false)
        }
    }, [])

    const loadViews = useCallback(async () => {
        setViewsLoading(true)
        setViewsError(null)
        try {
            const response = await fetchViews()
            setViews(response.views)
            setSelectedView((current) => {
                if (!current) {
                    return null
                }
                if (response.views.some((view) => view.slug === current)) {
                    return current
                }
                return null
            })
            setStatsRefreshKey((key) => key + 1)
        } catch (error) {
            setViewsError(error instanceof Error ? error.message : "Failed to load views")
        } finally {
            setViewsLoading(false)
        }
    }, [])

    const loadRows = useCallback(async (tableName: string, offset: number, limit: number) => {
        setRowsError(null)
        setRowsState(null)
        try {
            const response = await fetchRows(tableName, offset, limit)
            setRowsState(response)
        } catch (error) {
            setRowsError(error instanceof Error ? error.message : "Failed to load rows")
        }
    }, [])

    const executeViewRun = useCallback(
        async (viewSlug: string, paramNames: string[], values: Record<string, string>) => {
            setViewRunLoading(true)
            setViewRunError(null)
            setViewRunState(null)
            try {
                const response = await runView(viewSlug, paramsFromForm(paramNames, values))
                setViewRunState(response)
            } catch (error) {
                setViewRunError(error instanceof Error ? error.message : "Failed to run view")
            } finally {
                setViewRunLoading(false)
            }
        },
        []
    )

    useEffect(() => {
        void loadTables()
        void loadViews()
    }, [loadTables, loadViews])

    useEffect(() => {
        if (!selectedTable || mainView !== "rows") {
            return
        }
        void loadRows(selectedTable, rowOffset, rowLimit)
    }, [selectedTable, rowOffset, rowLimit, loadRows, mainView])

    useEffect(() => {
        if (!selectedViewSummary) {
            return
        }
        setViewParams(emptyParamValues(selectedViewSummary.param_names))
        setViewRunState(null)
        setViewRunError(null)
        if (selectedViewSummary.param_names.length === 0) {
            void executeViewRun(selectedViewSummary.slug, selectedViewSummary.param_names, {})
        }
    }, [selectedViewSummary?.slug, executeViewRun])

    useEffect(() => {
        const unsubscribeTables = vellumSubscribe({ tags: subscribeTagsForTableList() }, () => {
            void loadTables()
        })
        const unsubscribeViews = vellumSubscribe({ tags: subscribeTagsForViewList() }, () => {
            void loadViews()
        })
        return () => {
            unsubscribeTables?.()
            unsubscribeViews?.()
        }
    }, [loadTables, loadViews])

    useEffect(() => {
        if (!selectedTable) {
            return
        }
        const unsubscribeRows = vellumSubscribe(
            { tags: subscribeTagsForRowView(selectedTable) },
            (event) => {
                const matchedTags = event.tags ?? []
                const reloadList = matchedTags.includes(SYNC_TAGS.tables)
                const rowTableNames = matchedTags
                    .map((tag) => tableNameFromDataTag(tag))
                    .filter((name): name is string => name !== null)
                if (reloadList) {
                    void loadTables()
                }
                if (rowTableNames.includes(selectedTable)) {
                    void loadRows(selectedTable, rowOffset, rowLimit)
                }
            }
        )
        return unsubscribeRows ?? undefined
    }, [selectedTable, rowOffset, rowLimit, loadTables, loadRows])

    function handleSelectOverview(): void {
        setSelectedTable(null)
        setSelectedView(null)
        setMainView("rows")
    }

    function handleSidebarTabChange(tab: SidebarTab): void {
        setSidebarTab(tab)
        if (tab === "views") {
            setSelectedTable(null)
        } else {
            setSelectedView(null)
        }
    }

    function handleSelectTable(tableName: string): void {
        setSelectedView(null)
        setSelectedTable(tableName)
        setRowOffset(0)
        setMainView("rows")
        setSidebarTab("tables")
    }

    function handleSelectView(viewSlug: string): void {
        setSelectedTable(null)
        setSelectedView(viewSlug)
        setMainView("rows")
        setSidebarTab("views")
    }

    function handleTableCreated(tableName: string): void {
        void loadTables().then(() => {
            setSelectedView(null)
            setSelectedTable(tableName)
            setRowOffset(0)
            setMainView("rows")
            setSidebarTab("tables")
        })
    }

    function handleSchemaSaved(): void {
        void loadTables().then(() => {
            setMainView("rows")
            if (selectedTable) {
                void loadRows(selectedTable, rowOffset, rowLimit)
            }
        })
    }

    function handleLimitChange(limit: number): void {
        setRowLimit(limit)
        setRowOffset(0)
    }

    function handleViewParamChange(paramName: string, value: string): void {
        setViewParams((current) => ({ ...current, [paramName]: value }))
    }

    function handleViewRun(): void {
        if (!selectedViewSummary) {
            return
        }
        void executeViewRun(selectedViewSummary.slug, selectedViewSummary.param_names, viewParams)
    }

    const overviewSelected = mainView === "rows" && selectedTable === null && selectedView === null

    let mainContent: ComponentChild
    if (mainView === "create") {
        mainContent = (
            <CreateTableForm
                existingTables={tables}
                onCancel={() => setMainView("rows")}
                onCreated={handleTableCreated}
            />
        )
    } else if (mainView === "edit" && selectedTableSummary) {
        mainContent = (
            <EditTableForm
                table={selectedTableSummary}
                onCancel={() => setMainView("rows")}
                onSaved={handleSchemaSaved}
            />
        )
    } else if (selectedTableSummary) {
        mainContent = (
            <TableDetailView
                table={selectedTableSummary}
                rowsState={rowsState}
                rowsError={rowsError}
                rowLimit={rowLimit}
                onOffsetChange={setRowOffset}
                onLimitChange={handleLimitChange}
                onApplySuccess={() => {
                    void loadRows(selectedTable!, rowOffset, rowLimit)
                }}
            />
        )
    } else if (selectedViewSummary) {
        mainContent = (
            <ViewDetailView
                view={selectedViewSummary}
                paramNames={selectedViewParamNames}
                paramValues={viewParams}
                onParamChange={handleViewParamChange}
                onRun={handleViewRun}
                runState={viewRunState}
                runError={viewRunError}
                runLoading={viewRunLoading}
            />
        )
    } else {
        mainContent = (
            <DashboardView onNewTable={() => setMainView("create")} refreshKey={statsRefreshKey} />
        )
    }

    return (
        <AppShell
            sidebar={
                <DatabaseSidebar
                    sidebarTab={sidebarTab}
                    onSidebarTabChange={handleSidebarTabChange}
                    tables={tables}
                    views={views}
                    selectedTable={mainView === "create" ? null : selectedTable}
                    selectedView={selectedView}
                    overviewSelected={overviewSelected}
                    tablesLoading={tablesLoading}
                    viewsLoading={viewsLoading}
                    tablesError={tablesError}
                    viewsError={viewsError}
                    onSelectOverview={handleSelectOverview}
                    onSelectTable={handleSelectTable}
                    onSelectView={handleSelectView}
                    onNewTable={() => setMainView("create")}
                />
            }
            main={mainContent}
        />
    )
}
