export {
  defaultColumnData,
  emptyVisualColumn,
  emptyVisualTable,
} from "./defaults.ts";
export {
  ensurePrimaryKeyColumn,
  syncVisualColumnSlug,
  tableDefinitionToVisual,
  visualColumnFromName,
  visualToTableDefinition,
} from "./build.ts";
export {
  parseTableDefinitionText,
  validateScope,
  validateSlug,
} from "./parse.ts";
export { markSlugDirty, syncSlugFromName } from "./slug-sync.ts";
export type {
  RefTarget,
  VisualColumn,
  VisualColumnType,
  VisualTable,
} from "./types.ts";
export { refTargetsFromDefinitions, VISUAL_COLUMN_TYPES } from "./types.ts";
export { validateVisualTable, type ValidationResult } from "./validate.ts";
