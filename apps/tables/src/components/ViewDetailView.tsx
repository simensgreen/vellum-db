import type { ViewRunResponse, ViewSummary } from "../api.ts"
import { ViewParamsBar } from "./ViewParamsBar.tsx"
import { ViewResultsGrid } from "./ViewResultsGrid.tsx"

export function ViewDetailView({
    view,
    paramNames,
    paramValues,
    onParamChange,
    onRun,
    runState,
    runError,
    runLoading
}: {
    view: ViewSummary
    paramNames: string[]
    paramValues: Record<string, string>
    onParamChange: (paramName: string, value: string) => void
    onRun: () => void
    runState: ViewRunResponse | null
    runError: string | null
    runLoading: boolean
}) {
    const result = runState?.result ?? null

    return (
        <div class="view-detail">
            <ViewParamsBar
                paramNames={paramNames}
                values={paramValues}
                onChange={onParamChange}
                onRun={onRun}
                running={runLoading}
            />
            <header class="view-detail__header">
                <div class="view-detail__title-row">
                    <h2 class="view-detail__title">{view.name}</h2>
                    <span class="v-badge view-detail__kind">{view.kind}</span>
                    {view.scope ? (
                        <span class="v-badge view-detail__scope">{view.scope}</span>
                    ) : null}
                </div>
                {view.description ? (
                    <p class="view-detail__description">{view.description}</p>
                ) : null}
            </header>
            {runError ? <div class="app-message app-message--error">{runError}</div> : null}
            <ViewResultsGrid
                rows={result?.rows ?? null}
                count={result?.page_count ?? 0}
                totalCount={result?.total_count ?? 0}
                limit={result?.limit ?? 50}
                offset={result?.offset ?? 0}
                hasMore={result?.has_more ?? false}
                loading={runLoading}
                onOffsetChange={() => {}}
            />
        </div>
    )
}
