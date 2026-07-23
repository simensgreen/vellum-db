const MILLIS_PER_UTC_DAY = 86_400_000

/** UTC calendar days since 1970-01-01. */
export function utcEpochDay(date: Date = new Date()): number {
    return Math.floor(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MILLIS_PER_UTC_DAY
    )
}

/** ISO date YYYY-MM-DD for an epoch day (UTC). */
export function utcEpochDayToIso(day: number): string {
    const millis = day * MILLIS_PER_UTC_DAY
    const utcDate = new Date(millis)
    const year = utcDate.getUTCFullYear()
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, "0")
    const date = String(utcDate.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${date}`
}

export function addUtcEpochDays(day: number, deltaDays: number): number {
    return day + deltaDays
}
