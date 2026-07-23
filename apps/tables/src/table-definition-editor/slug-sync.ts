import { slugify } from "vellum-db/slugify"

export function syncSlugFromName(
    name: string,
    slugDirty: boolean,
    currentSlug: string
): { slug: string; slugDirty: boolean } {
    if (slugDirty) {
        return { slug: currentSlug, slugDirty: true }
    }
    const trimmed = name.trim()
    if (!trimmed) {
        return { slug: "", slugDirty: false }
    }
    try {
        return { slug: slugify(trimmed), slugDirty: false }
    } catch {
        return { slug: currentSlug, slugDirty: false }
    }
}

export function markSlugDirty(slug: string): { slug: string; slugDirty: boolean } {
    return { slug, slugDirty: true }
}
