import { useState } from "react"
import { defaultGlassOptions, Glass, type GlassOptions, GlassProvider } from "../lib"
import "./App.css"
import { DemoOptions } from "./options"

const kittens = [
  {
    name: "Luna",
    age: "3 months",
    breed: "British Shorthair",
    color: "Silver Tabby",
    personality: "Playful and curious, loves to explore every corner of the house",
    image: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop",
  },
  {
    name: "Milo",
    age: "5 months",
    breed: "Maine Coon",
    color: "Orange Tabby",
    personality:
      "Gentle giant in training, very affectionate and loves cuddles, is actually a Human Woman cause copilot couldn't find a better URL",
    image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=300&fit=crop",
  },
  {
    name: "Whiskers",
    age: "2 months",
    breed: "Siamese",
    color: "Seal Point",
    personality: "Vocal and social, always wants to be the center of attention",
    image: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&h=300&fit=crop",
  },
]

function App() {
  const [glassOptions, setGlassOptions] = useState<GlassOptions>(defaultGlassOptions)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Theme colors
  const theme = {
    glass: isDarkMode ? "#3b6175" : "#F8FAFC",
    bg: isDarkMode ? "#0f1419" : "#f0f0f0",
    text: isDarkMode ? "#e6e6e6" : "#333333",
    textSecondary: isDarkMode ? "#a0a0a0" : "#666666",
    cardBg1: isDarkMode ? "#1a1f2e" : "#f0f8ff",
    cardBg2: isDarkMode ? "#1f1a2e" : "#fff0f5",
    cardText1: isDarkMode ? "#60a5fa" : "#2c5aa0",
    cardText2: isDarkMode ? "#f472b6" : "#c71585",
    factBg1: isDarkMode ? "#1e293b" : "#e6f3ff",
    factBg2: isDarkMode ? "#2e1b3b" : "#ffe6f0",
    footerText: isDarkMode ? "#888888" : "#666666",
  }

  return (
    <GlassProvider deps={[isDarkMode]}>
      <div
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          minHeight: "100vh",
          width: "100%",
          transition: "background-color 0.3s ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          glass-ignore=""
          style={{
            display: "flex",
            flexDirection: "column",
            color: theme.text,
            gap: 32,
            position: "fixed",
            margin: "auto",
            zIndex: 10,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: 300,
            height: 600,
          }}
        >
          <Glass color={theme.glass} options={glassOptions}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                backgroundColor: "transparent",
              }}
            >
              <h2>Real Glass</h2>
              <span>Rendered with WebGL</span>
            </div>
          </Glass>
          <Glass color={theme.glass} options={glassOptions} reducedMotion>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                backgroundColor: "transparent",
              }}
            >
              <h2>Fallback Glass</h2>
              <span>Pure CSS with</span>
              <code>backdrop-filter: blur({(glassOptions.frost * 12).toFixed(1)}px)</code>
            </div>
          </Glass>
        </div>

        <DemoOptions onChange={setGlassOptions} onDarkModeChange={setIsDarkMode} />

        <div style={{ minHeight: "200vh", padding: "6rem 2rem", maxWidth: "720px", margin: "0" }}>
          {/* Header */}
          <header style={{ textAlign: "center", marginBottom: "60px" }}>
            <img
              src="https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&h=400&fit=crop"
              alt="Cute Kittens"
              style={{ width: "100%", borderRadius: "12px", marginBottom: "20px" }}
            />
            <h1 style={{ fontSize: "3.5em", margin: "0 0 20px 0", color: theme.text }}>🐱 Kitten Gallery</h1>
            <p style={{ fontSize: "1.2em", color: theme.textSecondary, maxWidth: "600px", margin: "0 auto" }}>
              Discover our adorable collection of kittens, each with their unique personality and charm. Scroll down to
              learn more about these precious furballs!
            </p>
          </header>

          {/* Introduction Section */}
          <section style={{ marginBottom: "80px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "30px",
                marginBottom: "40px",
              }}
            >
              <div
                style={{
                  padding: "30px",
                  backgroundColor: theme.cardBg1,
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                }}
              >
                <h2 style={{ margin: "0 0 15px 0", color: theme.cardText1 }}>🎯 Our Mission</h2>
                <p style={{ lineHeight: "1.6", color: theme.text }}>
                  We're dedicated to finding loving homes for adorable kittens. Each kitten receives proper care,
                  socialization, and lots of love before joining their forever family.
                </p>
              </div>
              <div
                style={{
                  padding: "30px",
                  backgroundColor: theme.cardBg2,
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                }}
              >
                <h2 style={{ margin: "0 0 15px 0", color: theme.cardText2 }}>💝 Why Adopt?</h2>
                <p style={{ lineHeight: "1.6", color: theme.text }}>
                  Adopting a kitten means giving a loving creature a second chance at happiness. You'll gain a loyal
                  companion who will bring joy, laughter, and endless purrs to your home.
                </p>
              </div>
            </div>
          </section>

          {/* Kitten Cards Section */}
          <section style={{ marginBottom: "80px" }}>
            <h2 style={{ textAlign: "center", fontSize: "2.5em", marginBottom: "50px", color: theme.text }}>
              Meet Our Kittens
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "100px" }}>
              {kittens.map((kitten, index) => (
                <div
                  key={kitten.name}
                  style={{
                    display: "flex",
                    flexDirection: index % 2 === 0 ? "row" : "row-reverse",
                    gap: "20px",
                    alignItems: "center",
                    // flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "1 1 400px" }}>
                    <img
                      src={kitten.image}
                      alt={kitten.name}
                      style={{
                        width: "100%",
                        height: "350px",
                        objectFit: "cover",
                        borderRadius: "16px",
                        boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                  <div style={{ flex: "1 1 400px", minWidth: "300px" }}>
                    <div style={{ padding: "30px", backgroundColor: "transparent" }}>
                      <h3 style={{ margin: "0 0 20px 0", fontSize: "2em", color: theme.text }}>{kitten.name}</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: theme.text }}>
                        <div>
                          <strong style={{ color: theme.textSecondary }}>Age:</strong> {kitten.age}
                        </div>
                        <div>
                          <strong style={{ color: theme.textSecondary }}>Breed:</strong> {kitten.breed}
                        </div>
                        <div>
                          <strong style={{ color: theme.textSecondary }}>Color:</strong> {kitten.color}
                        </div>
                        <div style={{ marginTop: "10px" }}>
                          <strong style={{ color: theme.textSecondary }}>Personality:</strong>
                          <p style={{ margin: "5px 0 0 0", lineHeight: "1.6" }}>{kitten.personality}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Fun Facts Section */}
          <section style={{ marginBottom: "80px" }}>
            <h2 style={{ textAlign: "center", fontSize: "2.5em", marginBottom: "40px", color: theme.text }}>
              Fun Kitten Facts
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
              {[
                "Kittens sleep 16-20 hours a day",
                "They can't see or hear when born",
                "A group of kittens is called a kindle",
                "Kittens have 26 baby teeth",
                "They start purring at one week old",
                "Kittens can run up to 30 mph",
              ].map((fact) => (
                <div
                  key={fact}
                  style={{
                    padding: "20px",
                    backgroundColor: fact.length % 2 === 0 ? theme.factBg1 : theme.factBg2,
                    borderRadius: "8px",
                    textAlign: "center",
                    fontSize: "0.95em",
                    lineHeight: "1.5",
                    color: theme.text,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  {fact}
                </div>
              ))}
            </div>
          </section>

          {/* Call to Action */}
          <section style={{ marginBottom: "60px", textAlign: "center" }}>
            <div style={{ maxWidth: "600px", margin: "0 auto" }}>
              <div style={{ padding: "40px", backgroundColor: "transparent" }}>
                <h2 style={{ margin: "0 0 20px 0", fontSize: "2em", color: theme.text }}>Ready to Adopt?</h2>
                <p style={{ lineHeight: "1.6", marginBottom: "25px", color: theme.text }}>
                  These adorable kittens are waiting for their forever homes. Give them the love and care they deserve!
                </p>
                <button
                  type="button"
                  style={{
                    padding: "12px 30px",
                    fontSize: "1.1em",
                    backgroundColor: "#ff6b9d",
                    color: "white",
                    border: "none",
                    borderRadius: "25px",
                    cursor: "pointer",
                    boxShadow: "0 4px 8px rgba(255,107,157,0.3)",
                  }}
                >
                  Contact Us Today
                </button>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: "60px", textAlign: "center" }}>
            <p style={{ color: theme.text, lineHeight: "1.8" }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas non faucibus purus, ut auctor mauris.
              Praesent ut convallis tellus. Donec consequat erat eu enim feugiat lacinia. Morbi at tellus luctus elit
              ornare dictum. Donec vitae pulvinar augue. Praesent sed viverra nulla. Vestibulum aliquet libero sit amet
              pharetra ultrices. Aliquam suscipit sem quam, vitae vehicula elit sodales eget. Maecenas porttitor
              consectetur velit, eget eleifend neque hendrerit eu. Phasellus cursus aliquet dictum. Nam ullamcorper
              bibendum dapibus. Ut tempus, augue nec egestas imperdiet, sem enim rutrum sem, ut commodo erat nibh vel
              risus. In sed iaculis urna, ac blandit nisi.
            </p>
            <p style={{ color: theme.text, lineHeight: "1.8" }}>
              Sed facilisis ligula vitae rutrum laoreet. Vestibulum id ultricies turpis. Praesent fringilla est sed
              ornare dignissim. Donec lacinia commodo sapien ac interdum. Praesent ut tellus lorem. Morbi rutrum
              malesuada tincidunt. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus
              mus. Aliquam et consequat lacus.
            </p>
            <p style={{ color: theme.text, lineHeight: "1.8" }}>
              Donec nec viverra risus. Cras at eros vitae mauris elementum vestibulum. Sed porttitor lobortis sodales.
              Duis eleifend justo sed diam ullamcorper congue. Quisque accumsan sem sed urna laoreet, sed vehicula ipsum
              pretium. Proin mauris nisi, fermentum sit amet ligula a, maximus feugiat erat. Aenean interdum arcu ut
              nunc porta congue. Pellentesque volutpat interdum enim vitae laoreet. Nunc ligula ligula, fermentum nec
              libero ac, tincidunt convallis velit.
            </p>
          </section>

          {/* Footer */}
          <footer style={{ textAlign: "center", padding: "40px 20px", color: theme.footerText, marginBottom: "8rem" }}>
            <p style={{ margin: "0 0 10px 0" }}>© 2025 Kitten Gallery - Made with ❤️ and Glass</p>
            <p style={{ margin: 0, fontSize: "0.9em" }}>Scroll to see the glass effect interact with the background!</p>
          </footer>
        </div>
      </div>
    </GlassProvider>
  )
}

export default App
