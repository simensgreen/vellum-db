import { useLayoutEffect, useRef } from "preact/hooks";
import type { ColumnDefinition } from "vellum-db/core/table/types";
import type { TableSummary } from "../api.ts";
import type { InsertFocusTarget } from "../useTableStaging.ts";
import {
  cellDisplayValue,
  formatCellValue,
  placeholderForColumn,
  primaryKeyColumnSlugs,
  type RowDraft,
  usesSelectEditor,
  visibleColumns,
} from "../row-editor.ts";

function cellClassNames(options: {
  dirty?: boolean;
  validationHighlight?: boolean;
  extra?: string;
}): string {
  const classes = ["rows-grid__cell"];
  if (options.extra) {
    classes.push(options.extra);
  }
  if (options.validationHighlight) {
    classes.push("rows-grid__cell--validation-error");
  } else if (options.dirty) {
    classes.push("rows-grid__cell--modified");
  }
  return classes.join(" ");
}

function boolCheckedValue(raw: string, rowValue: unknown): boolean {
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (typeof rowValue === "boolean") {
    return rowValue;
  }
  if (typeof rowValue === "number") {
    return rowValue !== 0;
  }
  return raw === "1";
}

function inputClassForColumn(column: ColumnDefinition): string {
  if (column.data.type === "json") {
    return "rows-grid__input rows-grid__input--mono";
  }
  if (column.data.type === "timestamp") {
    return "rows-grid__input rows-grid__input--timestamp";
  }
  return "rows-grid__input";
}

function TypedCellEditor({
  column,
  value,
  placeholder,
  inactive,
  rowValue,
  focusTarget,
  onFocused,
  onChange,
  onStartEditing,
  commitOnBlur = true,
  onStopEditing,
}: {
  column: ColumnDefinition;
  value: string;
  rowValue: unknown;
  placeholder: string;
  inactive: boolean;
  focusTarget?: InsertFocusTarget | null;
  onFocused?: () => void;
  onChange: (value: string, cursor: number) => void;
  onStartEditing?: () => void;
  commitOnBlur?: boolean;
  onStopEditing?: () => void;
}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const shouldFocusOnActivateRef = useRef(false);
  const showSelect = !inactive && usesSelectEditor(column);
  const inputClass = inputClassForColumn(column);

  function focusElement(element: HTMLElement, cursor?: number): void {
    element.focus();
    if (
      cursor !== undefined &&
      (element instanceof HTMLTextAreaElement ||
        (element instanceof HTMLInputElement &&
          element.type !== "checkbox" &&
          element.type !== "datetime-local"))
    ) {
      element.setSelectionRange(cursor, cursor);
    }
  }

  useLayoutEffect(() => {
    if (inactive) {
      shouldFocusOnActivateRef.current = true;
      return;
    }
    const element = elementRef.current;
    if (!element) {
      return;
    }
    if (focusTarget) {
      focusElement(element, focusTarget.cursor);
      onFocused?.();
      shouldFocusOnActivateRef.current = false;
      return;
    }
    if (!shouldFocusOnActivateRef.current) {
      return;
    }
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      focusElement(element, element.value.length);
    } else {
      element.focus();
    }
    shouldFocusOnActivateRef.current = false;
  }, [inactive, focusTarget, onFocused]);

  function assignRef(element: HTMLElement | null): void {
    elementRef.current = element;
  }

  function handleFocus(): void {
    if (inactive) {
      onStartEditing?.();
    }
  }

  function handleBlur(event: FocusEvent): void {
    if (inactive || !commitOnBlur) {
      return;
    }
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && elementRef.current?.contains(relatedTarget)) {
      return;
    }
    window.setTimeout(() => {
      if (document.activeElement === elementRef.current) {
        return;
      }
      onStopEditing?.();
    }, 0);
  }

  function handleInput(
    event: Event,
    readValue: (target: HTMLInputElement | HTMLTextAreaElement) => string,
  ): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    onChange(readValue(target), target.selectionStart ?? readValue(target).length);
  }

  const inputProps = {
    class: inputClass,
    value,
    placeholder,
    readOnly: inactive,
    onFocus: handleFocus,
    onClick: handleFocus,
    onBlur: handleBlur,
    ref: assignRef,
  };

  if (showSelect && column.data.type === "enum") {
    return (
      <select
        class={inputClass}
        value={value}
        ref={assignRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(event) => {
          const target = event.target as HTMLSelectElement;
          onChange(target.value, target.value.length);
          onStopEditing?.();
        }}
      >
        <option value="">—</option>
        {column.data.variants.map((variant: string) => (
          <option key={variant} value={variant}>
            {variant}
          </option>
        ))}
      </select>
    );
  }

  if (column.data.type === "bool") {
    return (
      <label class="rows-grid__checkbox-field">
        <input
          type="checkbox"
          class="rows-grid__input rows-grid__input--checkbox"
          checked={boolCheckedValue(value, rowValue)}
          ref={assignRef}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseDown={(event) => {
            if (inactive) {
              event.preventDefault();
              onStartEditing?.();
            }
          }}
          onChange={(event) => {
            if (inactive) {
              return;
            }
            const target = event.target as HTMLInputElement;
            onChange(target.checked ? "true" : "false", 0);
          }}
        />
      </label>
    );
  }

  switch (column.data.type) {
    case "int":
      return (
        <input
          {...inputProps}
          type="number"
          step={1}
          min={column.data.min}
          max={column.data.max}
          onInput={(event) =>
            handleInput(event, (target) => target.value)
          }
        />
      );
    case "float":
      return (
        <input
          {...inputProps}
          type="number"
          step="any"
          min={column.data.min}
          max={column.data.max}
          onInput={(event) =>
            handleInput(event, (target) => target.value)
          }
        />
      );
    case "timestamp":
      return (
        <input
          {...inputProps}
          type="datetime-local"
          onInput={(event) =>
            handleInput(event, (target) => target.value)
          }
        />
      );
    case "json":
      return (
        <input
          {...inputProps}
          type="text"
          onInput={(event) =>
            handleInput(event, (target) => target.value)
          }
        />
      );
    default:
      return (
        <input
          {...inputProps}
          type="text"
          onInput={(event) =>
            handleInput(event, (target) => target.value)
          }
        />
      );
  }
}

function RowCell({
  column,
  rowValue,
  draftValue,
  isEditing,
  readOnly,
  dirty,
  error,
  focusTarget,
  onFocused,
  onStartEditing,
  onStopEditing,
  onChange,
  commitOnBlur = true,
  useDraftValue = false,
  showValidationErrors = false,
}: {
  column: ColumnDefinition;
  rowValue: unknown;
  draftValue: string;
  isEditing: boolean;
  readOnly: boolean;
  dirty: boolean;
  error?: string;
  focusTarget?: InsertFocusTarget | null;
  onFocused?: () => void;
  onStartEditing?: () => void;
  onStopEditing?: () => void;
  onChange: (value: string, cursor: number) => void;
  commitOnBlur?: boolean;
  useDraftValue?: boolean;
  showValidationErrors?: boolean;
}) {
  const displayValue = useDraftValue
    ? draftValue
    : cellDisplayValue(column, rowValue, draftValue, dirty);
  const validationHighlight = showValidationErrors && Boolean(error);

  return (
    <td
      class={cellClassNames({
        dirty,
        validationHighlight,
        extra: readOnly ? "rows-grid__cell--pk" : undefined,
      })}
      title={error}
    >
      <div class="rows-grid__cell-inner">
        {readOnly ? (
          <span class="rows-grid__display rows-grid__display--readonly">
            {formatCellValue(rowValue, column) || "\u00a0"}
          </span>
        ) : (
          <TypedCellEditor
            column={column}
            value={displayValue}
            rowValue={rowValue}
            placeholder={placeholderForColumn(column)}
            inactive={!isEditing}
            focusTarget={focusTarget}
            onFocused={onFocused}
            onChange={onChange}
            onStartEditing={onStartEditing}
            onStopEditing={onStopEditing}
            commitOnBlur={commitOnBlur}
          />
        )}
      </div>
    </td>
  );
}

export function RowCells({
  table,
  row,
  draft,
  rowKey,
  editingSlug,
  alwaysEditing = false,
  dirtySlugs,
  fieldErrors,
  insertFocusTarget,
  onInsertFocused,
  onStartEditing,
  onStopEditing,
  onChange,
  showValidationErrors = false,
}: {
  table: TableSummary;
  row: Record<string, unknown>;
  draft: RowDraft;
  rowKey?: string;
  editingSlug?: string | null;
  alwaysEditing?: boolean;
  dirtySlugs?: Set<string>;
  fieldErrors?: Map<string, string>;
  insertFocusTarget?: InsertFocusTarget | null;
  onInsertFocused?: () => void;
  onStartEditing?: (slug: string) => void;
  onStopEditing?: () => void;
  onChange: (slug: string, value: string, cursor: number) => void;
  showValidationErrors?: boolean;
}) {
  const primaryKeys = primaryKeyColumnSlugs(table);
  const columns = visibleColumns(table);

  return (
    <>
      {columns.map((column) => {
        const readOnly = primaryKeys.has(column.slug);
        const isBoolColumn = column.data.type === "bool";
        const isEditing =
          alwaysEditing || isBoolColumn || editingSlug === column.slug;
        const focusTarget =
          rowKey &&
          insertFocusTarget &&
          insertFocusTarget.localId === rowKey &&
          insertFocusTarget.slug === column.slug
            ? insertFocusTarget
            : null;
        return (
          <RowCell
            key={column.slug}
            column={column}
            rowValue={row[column.slug]}
            draftValue={draft[column.slug] ?? ""}
            isEditing={isEditing}
            readOnly={readOnly}
            dirty={dirtySlugs?.has(column.slug) ?? false}
            error={fieldErrors?.get(column.slug)}
            focusTarget={focusTarget}
            onFocused={onInsertFocused}
            onStartEditing={() => onStartEditing?.(column.slug)}
            onStopEditing={onStopEditing}
            onChange={(value, cursor) => onChange(column.slug, value, cursor)}
            commitOnBlur={!alwaysEditing}
            useDraftValue={alwaysEditing}
            showValidationErrors={showValidationErrors}
          />
        );
      })}
    </>
  );
}

export function DraftInsertRowCells({
  table,
  draft,
  fieldErrors,
  showValidationErrors,
  onChange,
}: {
  table: TableSummary;
  draft: RowDraft;
  fieldErrors?: Map<string, string>;
  showValidationErrors?: boolean;
  onChange: (slug: string, value: string, cursor: number) => void;
}) {
  return (
    <RowCells
      table={table}
      row={{}}
      draft={draft}
      alwaysEditing
      fieldErrors={fieldErrors}
      showValidationErrors={showValidationErrors}
      onChange={onChange}
    />
  );
}
