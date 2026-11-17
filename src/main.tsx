import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import { useRoute } from "./router"
import { Showcase } from "./showcase"

function Root() {
  const route = useRoute()
  // a block and not an expression: scrollTo returns a promise in recent browsers, which React would take for a cleanup
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])
  return route === "showcase" ? <Showcase /> : <App />
}

// biome-ignore lint/style/noNonNullAssertion: vite entrypoint
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
