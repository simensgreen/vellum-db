import { assertSafeIdentifier } from "./identifiers.ts";

const SLUG_MAX_LENGTH = 64;

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function transliterateCharacter(character: string): string {
  const lower = character.toLowerCase();
  const mapped = CYRILLIC_TO_LATIN[lower];
  if (mapped !== undefined) {
    return mapped;
  }
  const normalized = character.normalize("NFKD");
  const stripped = normalized.replace(/\p{M}/gu, "");
  if (/^[a-z0-9]$/i.test(stripped)) {
    return stripped.toLowerCase();
  }
  return "_";
}

/** Transliterate + slugify display name → [a-z][a-z0-9_]* or throw if empty/invalid. */
export function slugify(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required for slug generation");
  }

  let slug = "";
  for (const character of trimmed.toLowerCase()) {
    if (/[a-z0-9]/.test(character)) {
      slug += character;
      continue;
    }
    if (character === " " || character === "-" || character === "\t") {
      slug += "_";
      continue;
    }
    slug += transliterateCharacter(character);
  }

  slug = slug
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) {
    throw new Error(`Cannot derive slug from name "${name}"`);
  }

  if (!/^[a-z]/.test(slug)) {
    slug = `t_${slug}`;
  }

  if (slug.length > SLUG_MAX_LENGTH) {
    slug = slug.slice(0, SLUG_MAX_LENGTH).replace(/_+$/, "");
  }

  return assertSafeIdentifier(slug, "column");
}
