import "./design-system.ts"
import { render } from "preact"
import { App } from "./components/App.tsx"

const mountElement = document.getElementById("app")
if (!mountElement) {
    throw new Error('Missing root element "#app"')
}
render(<App />, mountElement)
