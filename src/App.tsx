import { Glass, GlassProvider } from "../lib"
import "./App.css"

function App() {
  return (
    <GlassProvider>
      <h1>Hello World</h1>
      <Glass
        options={{}}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 300,
          height: 200,
        }}
      >
        <span>ciao!</span>
      </Glass>
    </GlassProvider>
  )
}

export default App
