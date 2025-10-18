import { useEffect, useState } from "react"
import { defaultGlassOptions, type GlassOptions } from "../lib/types/glass"

export function DemoOptions(props: {
  onChange?: (options: GlassOptions) => void
  onDarkModeChange?: (isDark: boolean) => void
}) {
  const [glassOptions, setGlassOptions] = useState<GlassOptions>(defaultGlassOptions)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    props.onChange?.(glassOptions)
  }, [props.onChange, glassOptions])

  useEffect(() => {
    props.onDarkModeChange?.(isDarkMode)
  }, [props.onDarkModeChange, isDarkMode])

  return (
    <div
      glass-ignore=""
      style={{
        position: "fixed",
        backgroundColor: "#222530",
        color: "white",
        right: 0,
        top: 0,
        height: "100vh",
        width: "320px",
        overflowY: "auto",
        zIndex: 1000,
        boxShadow: "-4px 0 12px rgba(0,0,0,0.3)",
      }}
    >
      <div
        style={{
          padding: "24px",
          backgroundColor: "transparent",
        }}
      >
        <h1 style={{ margin: "0 0 24px 0", fontSize: "1.8em" }}>Glass Options</h1>

        {/* Dark Mode Toggle */}
        <div style={{ marginBottom: "32px" }}>
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: isDarkMode ? "#4a5568" : "#444",
              color: "white",
              border: `2px solid ${isDarkMode ? "#60a5fa" : "#666"}`,
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "1em",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? "#5a6578" : "#555"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? "#4a5568" : "#444"
            }}
          >
            <span style={{ fontSize: "1.2em" }}>{isDarkMode ? "🌙" : "☀️"}</span>
            <span>{isDarkMode ? "Dark Mode" : "Light Mode"}</span>
          </button>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #444", margin: "32px 0" }} />

        {/* Refraction */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "block", marginBottom: "8px", fontSize: "0.9em", fontWeight: 500 }}>
            Refraction: {glassOptions.refraction.toFixed(2)}
          </div>
          <input
            type="range"
            min="1.0"
            max="2.0"
            step="0.01"
            value={glassOptions.refraction}
            onChange={(e) => setGlassOptions({ ...glassOptions, refraction: Number.parseFloat(e.target.value) })}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>Index of refraction (1.0 - 2.0)</div>
        </div>

        {/* Depth */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "block", marginBottom: "8px", fontSize: "0.9em", fontWeight: 500 }}>
            Depth: {glassOptions.depth.toFixed(1)}
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={glassOptions.depth}
            onChange={(e) => setGlassOptions({ ...glassOptions, depth: Number.parseFloat(e.target.value) })}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>Glass thickness</div>
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>
            relative to size: 0 (empty) - 1 (full)
          </div>
        </div>

        {/* Dispersion */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "block", marginBottom: "8px", fontSize: "0.9em", fontWeight: 500 }}>
            Dispersion: {glassOptions.dispersion.toFixed(2)}
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={glassOptions.dispersion}
            onChange={(e) => setGlassOptions({ ...glassOptions, dispersion: Number.parseFloat(e.target.value) })}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>Chromatic dispersion (0 - 1)</div>
        </div>

        {/* Frost */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "block", marginBottom: "8px", fontSize: "0.9em", fontWeight: 500 }}>
            Frost: {glassOptions.frost.toFixed(2)}
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={glassOptions.frost}
            onChange={(e) => setGlassOptions({ ...glassOptions, frost: Number.parseFloat(e.target.value) })}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>Surface roughness (0 - 1)</div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #444", margin: "32px 0" }} />

        {/* Light Section */}
        <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2em" }}>Light Properties</h3>

        {/* Light Angle */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "block", marginBottom: "8px", fontSize: "0.9em", fontWeight: 500 }}>
            Angle: {glassOptions.light.angle}°
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={glassOptions.light.angle}
            onChange={(e) =>
              setGlassOptions({
                ...glassOptions,
                light: { ...glassOptions.light, angle: Number.parseInt(e.target.value, 10) },
              })
            }
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>Light direction (0° - 360°)</div>
        </div>

        {/* Light Strength */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "block", marginBottom: "8px", fontSize: "0.9em", fontWeight: 500 }}>
            Strength: {glassOptions.light.strength.toFixed(1)}
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={glassOptions.light.strength}
            onChange={(e) =>
              setGlassOptions({
                ...glassOptions,
                light: { ...glassOptions.light, strength: Number.parseFloat(e.target.value) },
              })
            }
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>Light intensity (0 - 10)</div>
        </div>

        {/* Light Directionality */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "block", marginBottom: "8px", fontSize: "0.9em", fontWeight: 500 }}>
            Directionality: {glassOptions.light.directionality.toFixed(1)}
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={glassOptions.light.directionality}
            onChange={(e) =>
              setGlassOptions({
                ...glassOptions,
                light: { ...glassOptions.light, directionality: Number.parseFloat(e.target.value) },
              })
            }
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>Light directionality (0 - 1)</div>
          <div style={{ fontSize: "0.75em", color: "#aaa", marginTop: "4px" }}>
            How much the light is focused in a specific direction
          </div>
        </div>

        {/* Light Color */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "block", marginBottom: "12px", fontSize: "0.9em", fontWeight: 500 }}>Light Color</div>

          {/* Red */}
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "0.8em",
                color: "#ff6666",
              }}
            >
              R: {glassOptions.light.color[0].toFixed(2)}
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={glassOptions.light.color[0]}
              onChange={(e) =>
                setGlassOptions({
                  ...glassOptions,
                  light: {
                    ...glassOptions.light,
                    color: [
                      Number.parseFloat(e.target.value),
                      glassOptions.light.color[1],
                      glassOptions.light.color[2],
                    ],
                  },
                })
              }
              style={{ width: "100%", cursor: "pointer" }}
            />
          </div>

          {/* Green */}
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "0.8em",
                color: "#66ff66",
              }}
            >
              G: {glassOptions.light.color[1].toFixed(2)}
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={glassOptions.light.color[1]}
              onChange={(e) =>
                setGlassOptions({
                  ...glassOptions,
                  light: {
                    ...glassOptions.light,
                    color: [
                      glassOptions.light.color[0],
                      Number.parseFloat(e.target.value),
                      glassOptions.light.color[2],
                    ],
                  },
                })
              }
              style={{ width: "100%", cursor: "pointer" }}
            />
          </div>

          {/* Blue */}
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                display: "block",
                marginBottom: "4px",
                fontSize: "0.8em",
                color: "#6666ff",
              }}
            >
              B: {glassOptions.light.color[2].toFixed(2)}
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={glassOptions.light.color[2]}
              onChange={(e) =>
                setGlassOptions({
                  ...glassOptions,
                  light: {
                    ...glassOptions.light,
                    color: [
                      glassOptions.light.color[0],
                      glassOptions.light.color[1],
                      Number.parseFloat(e.target.value),
                    ],
                  },
                })
              }
              style={{ width: "100%", cursor: "pointer" }}
            />
          </div>

          {/* Color Preview */}
          <div
            style={{
              width: "100%",
              height: "40px",
              borderRadius: "8px",
              backgroundColor: `rgb(${glassOptions.light.color[0] * 255}, ${glassOptions.light.color[1] * 255}, ${glassOptions.light.color[2] * 255})`,
              border: "2px solid #444",
              marginTop: "8px",
            }}
          />
        </div>

        {/* Reset Button */}
        <button
          type="button"
          onClick={() => setGlassOptions(defaultGlassOptions)}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#444",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "0.9em",
            fontWeight: 500,
            marginTop: "24px",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#555"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#444"
          }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
