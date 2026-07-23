export const DEFAULT_SCOPE_LABEL = "Default";

export type ScopedItem = {
  scope: string | null;
};

export type ScopeGroup<T extends ScopedItem> = {
  scopeKey: string;
  label: string;
  items: T[];
};

export function groupByScope<T extends ScopedItem>(
  items: T[],
  compareItems?: (left: T, right: T) => number,
): ScopeGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const scopeKey = item.scope ?? "";
    const bucket = groups.get(scopeKey);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(scopeKey, [item]);
    }
  }

  const sortItems = compareItems ?? ((left: T, right: T) => 0);

  const orderedKeys = [...groups.keys()].sort((left, right) => {
    if (left === "") {
      return -1;
    }
    if (right === "") {
      return 1;
    }
    return left.localeCompare(right);
  });

  return orderedKeys.map((scopeKey) => ({
    scopeKey,
    label: scopeKey === "" ? DEFAULT_SCOPE_LABEL : scopeKey,
    items: [...(groups.get(scopeKey) ?? [])].sort(sortItems),
  }));
}
