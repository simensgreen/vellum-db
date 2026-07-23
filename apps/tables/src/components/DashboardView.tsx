import {
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    type ChartConfiguration,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip
} from "chart.js"
import { useEffect, useRef, useState } from "preact/hooks"
import { type DatabaseStatsResponse, fetchStats } from "../api.ts"

Chart.register(
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Legend,
    Tooltip
)

function cssVar(name: string, fallback: string): string {
    if (typeof document === "undefined") {
        return fallback
    }
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value.length > 0 ? value : fallback
}

function formatCount(value: number): string {
    return new Intl.NumberFormat().format(value)
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatBucketLabel(isoDate: string): string {
    const [, month, day] = isoDate.split("-")
    return `${day}.${month}`
}

function chartReadsColor(): string {
    const reads = cssVar("--v-usage-trend-tertiary", "#9ca3af")
    const background = cssVar("--v-surface-lift", "#ffffff")
    return `color-mix(in srgb, ${reads} 45%, ${background})`
}

function lineDatasetStyle(color: string) {
    const pointFill = cssVar("--v-surface-lift", "#ffffff")
    return {
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 4,
        pointBackgroundColor: pointFill,
        pointBorderColor: color,
        pointBorderWidth: 2
    }
}

function buildChartConfig(stats: DatabaseStatsResponse): ChartConfiguration {
    const labels = stats.buckets.map((bucket) => formatBucketLabel(bucket.start))
    const colors = {
        inserts: cssVar("--v-usage-trend-positive", "#10b981"),
        updates: cssVar("--v-usage-trend-mid", "#f59e0b"),
        deletions: cssVar("--v-usage-trend-negative", "#f87171"),
        reads: chartReadsColor(),
        rows: cssVar("--v-usage-trend-info", "#3b82f6"),
        bytes: cssVar("--v-system-negative-strong", "#da491a")
    }

    return {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    type: "bar",
                    label: "Inserts",
                    data: stats.buckets.map((bucket) => bucket.inserts),
                    backgroundColor: colors.inserts,
                    stack: "ops",
                    yAxisID: "yOps",
                    order: 2
                },
                {
                    type: "bar",
                    label: "Updates",
                    data: stats.buckets.map((bucket) => bucket.updates),
                    backgroundColor: colors.updates,
                    stack: "ops",
                    yAxisID: "yOps",
                    order: 2
                },
                {
                    type: "bar",
                    label: "Deletions",
                    data: stats.buckets.map((bucket) => bucket.deletions),
                    backgroundColor: colors.deletions,
                    stack: "ops",
                    yAxisID: "yOps",
                    order: 2
                },
                {
                    type: "bar",
                    label: "Reads",
                    data: stats.buckets.map((bucket) => bucket.reads),
                    backgroundColor: colors.reads,
                    stack: "ops",
                    yAxisID: "yOps",
                    order: 2
                },
                {
                    type: "line",
                    label: "Rows",
                    data: stats.buckets.map((bucket) => bucket.row_count),
                    yAxisID: "yCounts",
                    tension: 0.25,
                    order: 1,
                    ...lineDatasetStyle(colors.rows)
                },
                {
                    type: "line",
                    label: "DB size",
                    data: stats.buckets.map((bucket) => bucket.database_bytes),
                    yAxisID: "yBytes",
                    tension: 0.25,
                    order: 1,
                    ...lineDatasetStyle(colors.bytes)
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "bottom" },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const label = context.dataset.label ?? ""
                            const raw = context.parsed.y
                            if (raw === null || raw === undefined) {
                                return label
                            }
                            if (label === "DB size") {
                                return `${label}: ${formatBytes(raw)}`
                            }
                            return `${label}: ${formatCount(raw)}`
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                yOps: {
                    type: "linear",
                    position: "left",
                    stacked: true,
                    title: { display: true, text: "Operations" },
                    ticks: { precision: 0 }
                },
                yCounts: {
                    type: "linear",
                    position: "right",
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: "Rows" },
                    ticks: { precision: 0 }
                },
                yBytes: {
                    type: "linear",
                    position: "right",
                    offset: true,
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: "DB size" },
                    ticks: {
                        callback(tickValue) {
                            const numeric =
                                typeof tickValue === "string" ? Number(tickValue) : tickValue
                            return formatBytes(numeric)
                        }
                    }
                }
            }
        }
    }
}

export function DashboardView({
    onNewTable,
    refreshKey
}: {
    onNewTable: () => void
    refreshKey: number
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const chartRef = useRef<Chart | null>(null)
    const [stats, setStats] = useState<DatabaseStatsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        void fetchStats("day")
            .then((response) => {
                if (!cancelled) {
                    setStats(response)
                }
            })
            .catch((fetchError) => {
                if (!cancelled) {
                    setError(
                        fetchError instanceof Error ? fetchError.message : "Failed to load stats"
                    )
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false)
                }
            })
        return () => {
            cancelled = true
        }
    }, [refreshKey])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !stats || stats.summary.table_count === 0) {
            chartRef.current?.destroy()
            chartRef.current = null
            return
        }

        chartRef.current?.destroy()
        chartRef.current = new Chart(canvas, buildChartConfig(stats))

        const chartContainer = canvas.parentElement
        let resizeObserver: ResizeObserver | undefined
        if (chartContainer) {
            resizeObserver = new ResizeObserver(() => {
                chartRef.current?.resize()
            })
            resizeObserver.observe(chartContainer)
        }

        return () => {
            resizeObserver?.disconnect()
            chartRef.current?.destroy()
            chartRef.current = null
        }
    }, [stats])

    if (loading && !stats) {
        return <div class="v-empty-state">Loading overview…</div>
    }

    if (error && !stats) {
        return <div class="app-message app-message--error">{error}</div>
    }

    if (!stats) {
        return <div class="v-empty-state">No stats available.</div>
    }

    const summary = stats.summary

    if (summary.table_count === 0) {
        return (
            <div class="dashboard">
                <div class="dashboard__empty v-card">
                    <h2 class="dashboard__empty-title">No tables yet</h2>
                    <p class="dashboard__empty-text">
                        Create your first table to start storing structured data.
                    </p>
                    <button type="button" class="v-button" onClick={onNewTable}>
                        Create first table
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div class="dashboard">
            <div class="dashboard__cards">
                <div class="dashboard__card v-card">
                    <span class="dashboard__card-label">Tables</span>
                    <span class="dashboard__card-value">{formatCount(summary.table_count)}</span>
                </div>
                <div class="dashboard__card v-card">
                    <span class="dashboard__card-label">Rows</span>
                    <span class="dashboard__card-value">{formatCount(summary.row_count)}</span>
                </div>
                <div class="dashboard__card v-card">
                    <span class="dashboard__card-label">Database size</span>
                    <span class="dashboard__card-value">{formatBytes(summary.database_bytes)}</span>
                </div>
            </div>

            {error ? <div class="app-message app-message--error">{error}</div> : null}

            <div class="dashboard__chart v-card v-billing-chart">
                <canvas ref={canvasRef} class="dashboard__canvas" />
            </div>
        </div>
    )
}
