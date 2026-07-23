import type { TableDefinition } from "../../src/core/table/types.ts";

export const tasksDefinition: TableDefinition = {
  slug: "tasks",
  name: "Tasks",
  columns: [
    {
      name: "Task ID",
      slug: "task_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Title",
      slug: "title",
      data: { type: "str", minLen: 1 },
    },
    {
      name: "Status",
      slug: "status",
      data: { type: "str" },
    },
    {
      name: "Points",
      slug: "points",
      data: { type: "int", min: 0 },
    },
  ],
};

export const itemsDefinition: TableDefinition = {
  slug: "items",
  name: "Items",
  columns: [
    {
      name: "Item ID",
      slug: "item_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Title",
      slug: "title",
      data: { type: "str" },
    },
    {
      name: "Points",
      slug: "points",
      data: { type: "int" },
    },
    {
      name: "Active",
      slug: "active",
      data: { type: "bool", default: false },
    },
  ],
};

export const scratchDefinition: TableDefinition = {
  slug: "scratch",
  name: "Scratch",
  columns: [
    {
      name: "Note ID",
      slug: "note_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Note",
      slug: "note",
      data: { type: "str" },
    },
  ],
};

export const alphaTasksDefinition: TableDefinition = {
  slug: "alpha_tasks",
  name: "Alpha Tasks",
  columns: [
    {
      name: "Task ID",
      slug: "task_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Title",
      slug: "title",
      data: { type: "str" },
    },
  ],
};

export const betaNotesDefinition: TableDefinition = {
  slug: "beta_notes",
  name: "Beta Notes",
  columns: [
    {
      name: "Note ID",
      slug: "note_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Body",
      slug: "body",
      data: { type: "str" },
    },
  ],
};

export const orphanDefinition: TableDefinition = {
  slug: "orphan",
  name: "Orphan",
  columns: [
    {
      name: "Entry ID",
      slug: "entry_id",
      primaryKey: true,
      data: { type: "nanoid", default: "random" },
    },
    {
      name: "Note",
      slug: "note",
      data: { type: "str" },
    },
  ],
};
