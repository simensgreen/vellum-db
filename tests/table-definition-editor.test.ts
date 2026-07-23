import { describe, expect, test } from "bun:test";
import {
  emptyVisualColumn,
  emptyVisualTable,
  parseTableDefinitionText,
  syncSlugFromName,
  tableDefinitionToVisual,
  validateScope,
  validateSlug,
  validateVisualTable,
  visualToTableDefinition,
} from "../apps/tables/src/table-definition-editor/index.ts";
import { tasksDefinition } from "./fixtures/table-definitions.ts";

describe("table-definition-editor", () => {
  test("visualToTableDefinition builds TableDefinition", () => {
    const visual = tableDefinitionToVisual(tasksDefinition);
    const definition = visualToTableDefinition(visual);
    expect(definition.slug).toBe("tasks");
    expect(definition.columns.find((column) => column.slug === "task_id")?.data).toEqual({
      type: "nanoid",
      default: "random",
    });
    expect(definition.columns).toHaveLength(4);
  });

  test("validateVisualTable accepts valid definition", () => {
    const visual = tableDefinitionToVisual(tasksDefinition);
    const result = validateVisualTable(visual);
    expect(result.ok).toBe(true);
  });

  test("syncSlugFromName derives slug until dirty", () => {
    expect(syncSlugFromName("My Tasks", false, "")).toEqual({
      slug: "my_tasks",
      slugDirty: false,
    });
    expect(syncSlugFromName("Renamed", true, "custom_slug")).toEqual({
      slug: "custom_slug",
      slugDirty: true,
    });
  });

  test("parseTableDefinitionText validates JSON object", () => {
    expect(parseTableDefinitionText(JSON.stringify(tasksDefinition)).error).toBeNull();
    expect(parseTableDefinitionText("[]").error).toContain("JSON object");
    expect(parseTableDefinitionText("{").error).toBeTruthy();
  });

  test("validateSlug enforces identifier pattern", () => {
    expect(validateSlug("tasks")).toBeNull();
    expect(validateSlug("Tasks")).toContain("match");
    expect(validateSlug("")).toContain("required");
  });

  test("validateScope allows empty or valid scope", () => {
    expect(validateScope("")).toBeNull();
    expect(validateScope("finance")).toBeNull();
    expect(validateScope("Finance")).toContain("match");
  });

  test("emptyVisualTable starts with system id column", () => {
    const visual = emptyVisualTable();
    expect(visual.columns).toHaveLength(1);
    const idColumn = visual.columns[0];
    expect(idColumn?.name).toBe("id");
    expect(idColumn?.slug).toBe("id");
    expect(idColumn?.systemId).toBe(true);
    expect(idColumn?.primaryKey).toBe(true);
    expect(idColumn?.unique).toBe(true);
    expect(idColumn?.data.type).toBe("nanoid");
  });

  test("emptyVisualColumn defaults to nanoid", () => {
    expect(emptyVisualColumn().data.type).toBe("nanoid");
  });
});
