import type { ComponentChildren } from "preact";

export function AppShell({
  sidebar,
  main,
}: {
  sidebar: ComponentChildren;
  main: ComponentChildren;
}) {
  return (
    <div class="app-shell">
      {sidebar}
      <main class="app-shell__main">{main}</main>
    </div>
  );
}
