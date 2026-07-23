import { nanoid } from "nanoid";
import type { ColumnData } from "vellum-db/core/table/types";
import type { RefTarget } from "../table-definition-editor/types.ts";
import {
  VISUAL_COLUMN_TYPES,
  VISUAL_COLUMN_TYPE_LABELS,
} from "../table-definition-editor/types.ts";
import { ButtonSwitch } from "./ButtonSwitch.tsx";
import { EnumVariantsEditor } from "./EnumVariantsEditor.tsx";
import { RefColumnFields } from "./RefColumnFields.tsx";

function TypeSelect({
  typeName,
  onSwitchType,
}: {
  typeName: ColumnData["type"];
  onSwitchType: (nextType: ColumnData["type"]) => void;
}) {
  return (
    <label class="form-field">
      <span>Type</span>
      <select
        value={typeName}
        onChange={(event) =>
          onSwitchType(
            (event.target as HTMLSelectElement).value as ColumnData["type"],
          )
        }
      >
        {VISUAL_COLUMN_TYPES.map((type) => (
          <option key={type} value={type}>
            {VISUAL_COLUMN_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </label>
  );
}

function ValidationErrorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (error: string | undefined) => void;
}) {
  return (
    <label class="form-field column-type-fields__full">
      <span>Error message</span>
      <input
        type="text"
        value={value}
        placeholder="Shown when validation fails"
        onInput={(event) => {
          const text = (event.target as HTMLInputElement).value;
          onChange(text === "" ? undefined : text);
        }}
      />
    </label>
  );
}

export function ColumnTypeFields({
  data,
  refTargets,
  onChange,
}: {
  data: ColumnData;
  refTargets: RefTarget[];
  onChange: (next: ColumnData) => void;
}) {
  const typeName = data.type;

  function switchType(nextType: ColumnData["type"]): void {
    switch (nextType) {
      case "bool":
        onChange({ type: "bool", default: false });
        return;
      case "enum":
        onChange({ type: "enum", variants: [] });
        return;
      case "int":
        onChange({ type: "int" });
        return;
      case "float":
        onChange({ type: "float" });
        return;
      case "timestamp":
        onChange({ type: "timestamp", default: "now" });
        return;
      case "json":
        onChange({ type: "json" });
        return;
      case "ref":
        onChange({ type: "ref", table: "", column: "" });
        return;
      case "nanoid":
        onChange({ type: "nanoid", default: "random" });
        return;
      default:
        onChange({ type: "str" });
    }
  }

  return (
    <div class="column-type-fields">
      {typeName === "str" ? (
        <>
          <div class="column-type-fields__row">
            <TypeSelect typeName={typeName} onSwitchType={switchType} />
            <label class="form-field">
              <span>Default</span>
              <select
                value={data.default !== undefined ? "value" : "none"}
                onChange={(event) => {
                  const mode = (event.target as HTMLSelectElement).value;
                  if (mode === "value") {
                    onChange({ ...data, default: "" });
                  } else {
                    const { default: _removed, ...rest } = data;
                    onChange(rest as ColumnData);
                  }
                }}
              >
                <option value="none">None</option>
                <option value="value">Value</option>
              </select>
            </label>
          </div>
          {data.default !== undefined ? (
            <label class="form-field column-type-fields__full">
              <span>Default value</span>
              <input
                type="text"
                value={data.default ?? ""}
                onInput={(event) => {
                  const value = (event.target as HTMLInputElement).value;
                  if (value === "") {
                    const { default: _removed, ...rest } = data;
                    onChange(rest as ColumnData);
                  } else {
                    onChange({ ...data, default: value });
                  }
                }}
              />
            </label>
          ) : null}
          <div class="column-type-fields__row">
            <label class="form-field">
              <span>Min length</span>
              <input
                type="number"
                min={0}
                value={data.minLen ?? ""}
                onInput={(event) => {
                  const raw = (event.target as HTMLInputElement).value;
                  if (raw === "") {
                    const { minLen: _removed, ...rest } = data;
                    onChange(rest as ColumnData);
                  } else {
                    onChange({ ...data, minLen: Number(raw) });
                  }
                }}
              />
            </label>
            <label class="form-field">
              <span>Max length</span>
              <input
                type="number"
                min={0}
                value={data.maxLen ?? ""}
                onInput={(event) => {
                  const raw = (event.target as HTMLInputElement).value;
                  if (raw === "") {
                    const { maxLen: _removed, ...rest } = data;
                    onChange(rest as ColumnData);
                  } else {
                    onChange({ ...data, maxLen: Number(raw) });
                  }
                }}
              />
            </label>
          </div>
          <label class="form-field column-type-fields__full">
            <span>Regex pattern</span>
            <input
              type="text"
              value={data.regex?.regex ?? ""}
              placeholder="^[a-z]+$"
              onInput={(event) => {
                const pattern = (event.target as HTMLInputElement).value;
                if (pattern === "") {
                  const { regex: _removed, ...rest } = data;
                  onChange(rest as ColumnData);
                } else {
                  onChange({
                    ...data,
                    regex: { ...data.regex, regex: pattern },
                  });
                }
              }}
            />
          </label>
          {data.minLen !== undefined ||
          data.maxLen !== undefined ||
          data.regex?.regex ? (
            <ValidationErrorField
              value={data.error ?? ""}
              onChange={(error) => {
                if (error === undefined) {
                  const { error: _removed, ...rest } = data;
                  onChange(rest as ColumnData);
                } else {
                  onChange({ ...data, error });
                }
              }}
            />
          ) : null}
        </>
      ) : null}

      {typeName === "nanoid" ? (
        <>
          <div class="column-type-fields__row">
            <TypeSelect typeName={typeName} onSwitchType={switchType} />
            <label class="form-field">
              <span>Default</span>
              <select
                value={data.default === "random" ? "random" : "literal"}
                onChange={(event) => {
                  const mode = (event.target as HTMLSelectElement).value;
                  if (mode === "random") {
                    onChange({ type: "nanoid", default: "random" });
                  } else {
                    onChange({ type: "nanoid", default: { value: nanoid() } });
                  }
                }}
              >
                <option value="random">Random (on insert)</option>
                <option value="literal">Fixed value</option>
              </select>
            </label>
          </div>
          {data.default !== "random" ? (
            <label class="form-field column-type-fields__full">
              <span>Default value</span>
              <div class="v-input-row">
                <input
                  type="text"
                  value={data.default.value}
                  onInput={(event) =>
                    onChange({
                      type: "nanoid",
                      default: {
                        value: (event.target as HTMLInputElement).value,
                      },
                    })
                  }
                />
                <button
                  type="button"
                  class="v-button secondary"
                  onClick={() =>
                    onChange({
                      type: "nanoid",
                      default: { value: nanoid() },
                    })
                  }
                >
                  Generate
                </button>
              </div>
            </label>
          ) : null}
        </>
      ) : null}

      {typeName === "int" || typeName === "float" ? (
        <>
          <div class="column-type-fields__row">
            <TypeSelect typeName={typeName} onSwitchType={switchType} />
            <label class="form-field">
              <span>Default</span>
              <input
                type="number"
                value={data.default ?? ""}
                onInput={(event) => {
                  const raw = (event.target as HTMLInputElement).value;
                  if (raw === "") {
                    const { default: _removed, ...rest } = data;
                    onChange(rest as ColumnData);
                  } else {
                    onChange({ ...data, default: Number(raw) });
                  }
                }}
              />
            </label>
          </div>
          <div class="column-type-fields__row">
            <label class="form-field">
              <span>Min</span>
              <input
                type="number"
                value={data.min ?? ""}
                onInput={(event) => {
                  const raw = (event.target as HTMLInputElement).value;
                  if (raw === "") {
                    const { min: _removed, ...rest } = data;
                    onChange(rest as ColumnData);
                  } else {
                    onChange({ ...data, min: Number(raw) });
                  }
                }}
              />
            </label>
            <label class="form-field">
              <span>Max</span>
              <input
                type="number"
                value={data.max ?? ""}
                onInput={(event) => {
                  const raw = (event.target as HTMLInputElement).value;
                  if (raw === "") {
                    const { max: _removed, ...rest } = data;
                    onChange(rest as ColumnData);
                  } else {
                    onChange({ ...data, max: Number(raw) });
                  }
                }}
              />
            </label>
          </div>
          {data.min !== undefined || data.max !== undefined ? (
            <ValidationErrorField
              value={data.error ?? ""}
              onChange={(error) => {
                if (error === undefined) {
                  const { error: _removed, ...rest } = data;
                  onChange(rest as ColumnData);
                } else {
                  onChange({ ...data, error });
                }
              }}
            />
          ) : null}
        </>
      ) : null}

      {typeName === "bool" ? (
        <div class="column-type-fields__row">
          <TypeSelect typeName={typeName} onSwitchType={switchType} />
          <div class="form-field">
            <span>Default</span>
            <ButtonSwitch
              label={data.default ? "True" : "False"}
              pressed={data.default}
              onPressedChange={(pressed) =>
                onChange({ ...data, default: pressed })
              }
            />
          </div>
        </div>
      ) : null}

      {typeName === "enum" ? (
        <>
          <TypeSelect typeName={typeName} onSwitchType={switchType} />
          <EnumVariantsEditor
            variants={data.variants}
            defaultIndex={data.default}
            onChange={(variants, defaultIndex) =>
              onChange({
                type: "enum",
                variants,
                ...(defaultIndex !== undefined ? { default: defaultIndex } : {}),
              })
            }
          />
        </>
      ) : null}

      {typeName === "timestamp" ? (
        <>
          <div class="column-type-fields__row">
            <TypeSelect typeName={typeName} onSwitchType={switchType} />
            <label class="form-field">
              <span>Default</span>
              <select
                value={
                  data.default === "now"
                    ? "now"
                    : data.default !== undefined
                      ? "literal"
                      : "none"
                }
                onChange={(event) => {
                  const mode = (event.target as HTMLSelectElement).value;
                  if (mode === "now") {
                    onChange({ type: "timestamp", default: "now" });
                  } else if (mode === "literal") {
                    onChange({
                      type: "timestamp",
                      default: { value: new Date().toISOString() },
                    });
                  } else {
                    onChange({ type: "timestamp" });
                  }
                }}
              >
                <option value="none">None</option>
                <option value="now">Now (on insert)</option>
                <option value="literal">ISO literal</option>
              </select>
            </label>
          </div>
          {data.default !== undefined && data.default !== "now" ? (
            <label class="form-field column-type-fields__full">
              <span>Default value</span>
              <div class="v-input-row">
                <input
                  type="text"
                  value={data.default.value}
                  onInput={(event) =>
                    onChange({
                      type: "timestamp",
                      default: {
                        value: (event.target as HTMLInputElement).value,
                      },
                    })
                  }
                />
                <button
                  type="button"
                  class="v-button secondary"
                  onClick={() =>
                    onChange({
                      type: "timestamp",
                      default: { value: new Date().toISOString() },
                    })
                  }
                >
                  Update
                </button>
              </div>
            </label>
          ) : null}
        </>
      ) : null}

      {typeName === "json" ? (
        <>
          <TypeSelect typeName={typeName} onSwitchType={switchType} />
          <label class="form-field form-field--stacked column-type-fields__full">
            <span>Nested JSON Schema</span>
            <textarea
              rows={4}
              placeholder='{"type":"object"}'
              value={data.schema ? JSON.stringify(data.schema, null, 2) : ""}
              onInput={(event) => {
                const text = (event.target as HTMLTextAreaElement).value.trim();
                if (!text) {
                  onChange({ type: "json" });
                  return;
                }
                try {
                  const parsed = JSON.parse(text) as Record<string, unknown>;
                  onChange({ type: "json", schema: parsed });
                } catch {
                  // keep typing
                }
              }}
            />
          </label>
        </>
      ) : null}

      {typeName === "ref" ? (
        <>
          <TypeSelect typeName={typeName} onSwitchType={switchType} />
          <RefColumnFields
            table={data.table}
            column={data.column}
            onDelete={data.onDelete}
            onUpdate={data.onUpdate}
            refTargets={refTargets}
            onChange={(patch) => onChange({ ...data, ...patch })}
          />
        </>
      ) : null}
    </div>
  );
}
