import { useEffect, useState } from "preact/hooks";
import { groupByScope, type ScopedItem } from "../group-by-scope.ts";

export function ScopeAccordionList<T extends ScopedItem>({
  items,
  selectedKey,
  getKey,
  getLabel,
  onSelect,
  emptyMessage,
}: {
  items: T[];
  selectedKey: string | null;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (key: string) => void;
  emptyMessage: string;
}) {
  const groups = groupByScope(items, (left, right) =>
    getLabel(left).localeCompare(getLabel(right)),
  );

  const selectedGroupKey = (() => {
    if (!selectedKey) {
      return null;
    }
    for (const group of groups) {
      if (group.items.some((item) => getKey(item) === selectedKey)) {
        return group.scopeKey;
      }
    }
    return null;
  })();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (selectedGroupKey === null) {
      return;
    }
    setExpandedGroups((current) => {
      if (current[selectedGroupKey] === true) {
        return current;
      }
      return { ...current, [selectedGroupKey]: true };
    });
  }, [selectedGroupKey]);

  function isGroupOpen(scopeKey: string): boolean {
    return expandedGroups[scopeKey] === true;
  }

  function toggleGroup(scopeKey: string): void {
    setExpandedGroups((current) => ({
      ...current,
      [scopeKey]: !isGroupOpen(scopeKey),
    }));
  }

  if (items.length === 0) {
    return <div class="v-empty-state scope-accordion__empty">{emptyMessage}</div>;
  }

  return (
    <div class="v-accordion scope-accordion">
      {groups.map((group) => {
        const open = isGroupOpen(group.scopeKey);
        return (
          <div
            key={group.scopeKey || "__default__"}
            class="v-accordion-item scope-accordion__item"
            data-open={open ? "true" : "false"}
          >
            <button
              type="button"
              class="v-accordion-header scope-accordion__header"
              aria-expanded={open}
              onClick={() => toggleGroup(group.scopeKey)}
            >
              <span class="scope-accordion__title">{group.label}</span>
            </button>
            {open ? (
              <div class="v-accordion-body scope-accordion__body">
                <ul class="v-list table-list">
                  {group.items.map((item) => {
                    const key = getKey(item);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          class={`v-list-item table-list__item${selectedKey === key ? " table-list__item--selected" : ""}`}
                          onClick={() => onSelect(key)}
                        >
                          <span class="table-list__name">{getLabel(item)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
