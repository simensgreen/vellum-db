import { describe, expect, test } from "bun:test"
import { slugify } from "../src/slugify.ts"

describe("slugify", () => {
    test("transliterates cyrillic", () => {
        expect(slugify("Задачи")).toBe("zadachi")
    })

    test("spaces become underscores", () => {
        expect(slugify("My Table")).toBe("my_table")
    })

    test("strips latin accents via nfkd", () => {
        expect(slugify("État")).toBe("etat")
    })

    test("prefixes when result does not start with a letter", () => {
        expect(slugify("123 items")).toBe("t_123_items")
    })

    test("rejects empty input", () => {
        expect(() => slugify("   ")).toThrow("Name is required")
    })
})
