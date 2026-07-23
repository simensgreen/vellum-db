import { isCardPreview } from "../platform/isCardPreview.ts";
import { CardPreview } from "./CardPreview.tsx";
import { DatabaseApp } from "./DatabaseApp.tsx";

export function App() {
  if (isCardPreview()) {
    return <CardPreview />;
  }
  return <DatabaseApp />;
}
