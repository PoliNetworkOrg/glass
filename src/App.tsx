import { Glass, GlassProvider, type SceneConfig, SceneConfigSchema } from "@polinetwork/glass"
import { useState } from "react"
import "./App.css"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DemoOptions, getDefaultValues } from "./options"

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

const defaultConfig = getDefaultValues(SceneConfigSchema)

function App() {
  const [glassOptions, setGlassOptions] = useState<SceneConfig>(SceneConfigSchema.parse(defaultConfig))
  const [isDarkMode, setIsDarkMode] = useState(false)

  const glassColor = isDarkMode ? "#3b6175" : "#F8FAFC"

  return (
    <GlassProvider deps={[isDarkMode]}>
      <div className={isDarkMode ? "dark" : ""}>
        <div className="min-h-screen bg-background">
          {/* Demo Glass Elements */}
          <div
            glass-ignore=""
            className="fixed inset-0 m-auto z-10 flex flex-col gap-8 w-[300px] h-[600px] pointer-events-none"
          >
            <Glass color={glassColor} options={glassOptions}>
              <div className="flex flex-col items-center justify-center flex-1 text-foreground">
                <h2 className="text-2xl font-bold">Real Glass</h2>
                <span className="text-sm text-muted-foreground">Rendered with WebGL</span>
              </div>
            </Glass>
            <Glass color={glassColor} options={glassOptions} reducedMotion>
              <div className="flex flex-col items-center justify-center flex-1 text-foreground">
                <h2 className="text-2xl font-bold">Fallback Glass</h2>
                <span className="text-sm text-muted-foreground">Pure CSS</span>
                <code className="text-xs mt-2">blur: {(glassOptions.material.roughness * 12).toFixed(1)}px</code>
              </div>
            </Glass>
          </div>

          {/* Options Panel */}
          <DemoOptions onChange={setGlassOptions} onDarkModeChange={setIsDarkMode} isDarkMode={isDarkMode} />

          {/* Content */}
          <div className="min-h-[200vh] max-w-4xl mx-auto px-4 py-36 space-y-16">
            {/* Header */}
            <header className="text-center space-y-4">
              <img
                src="https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=864&h=300&fit=crop"
                alt="Hero"
                className="w-full rounded-lg mb-12"
              />
              <h1 className="text-5xl font-bold text-accent-foreground">🐱 Kitten Gallery</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Discover our adorable collection of kittens, each with their unique personality and charm. Scroll down
                to learn more about these precious furballs!
              </p>
            </header>

            {/* Cards Grid */}
            <section className="grid md:grid-cols-2 gap-6">
              <Card className="bg-sky-500/40">
                <CardHeader>
                  <CardTitle>🎯 Our Mission</CardTitle>
                </CardHeader>
                <CardContent>
                  We're dedicated to finding loving homes for adorable kittens. Each kitten receives proper care,
                  socialization, and lots of love before joining their forever family.
                </CardContent>
              </Card>
              <Card className="bg-pink-500/40">
                <CardHeader>
                  <CardTitle>💝 Why Adopt?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>
                    Adopting a kitten means giving a loving creature a second chance at happiness. You'll gain a loyal
                    companion who will bring joy, laughter, and endless purrs to your home.
                  </p>
                </CardContent>
              </Card>
            </section>

            <section>
              <h1 className="text-3xl font-bold text-center m-8">Meet Our Kittens</h1>
              <div className="flex flex-col gap-8">
                {kittens.map((kitten, i) => (
                  <div key={kitten.name} className={`flex gap-8 ${i % 2 === 0 ? "flex-row" : "flex-row-reverse"}`}>
                    <img src={kitten.image} alt={kitten.name} className="flex-1 h-full object-cover rounded-lg" />
                    <Card className="flex-1 border-l rounded-lg">
                      <CardContent className="p-6">
                        <h1 className="text-xl font-semibold">{kitten.name}</h1>
                        <p className="text-sm text-muted-foreground mb-2"> • {kitten.age}</p>
                        <p className="text-sm text-muted-foreground mb-2"> • {kitten.breed}</p>
                        <p className="text-sm text-muted-foreground mb-2"> • {kitten.color}</p>
                        <p className="text-sm">{kitten.personality}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </section>

            {/* Features */}
            <section className="space-y-8">
              <h2 className="text-3xl font-bold text-center">Key Features</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  "Kittens sleep 16-20 hours a day",
                  "They can't see or hear when born",
                  "A group of kittens is called a kindle",
                  "Kittens have 26 baby teeth",
                  "They start purring at one week old",
                  "Kittens can run up to 30 mph",
                ].map((feature, i) => (
                  <Card key={feature} className={`${i % 2 === 0 ? "bg-sky-500/40" : "bg-pink-500/40"}`}>
                    <CardContent className="pt-6 text-center">
                      <p className="font-medium">{feature}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="text-center space-y-6">
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-2xl">Try It Out</CardTitle>
                  <CardDescription>
                    {" "}
                    These adorable kittens are waiting for their forever homes. Give them the love and care they
                    deserve!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="lg" variant="destructive">
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </section>

            {/* Filler Content */}
            <section className="space-y-4 text-muted-foreground">
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas non faucibus purus, ut auctor mauris.
                Praesent ut convallis tellus. Donec consequat erat eu enim feugiat lacinia. Morbi at tellus luctus elit
                ornare dictum. Donec vitae pulvinar augue. Praesent sed viverra nulla. Vestibulum aliquet libero sit
                amet pharetra ultrices. Aliquam suscipit sem quam, vitae vehicula elit sodales eget. Maecenas porttitor
                consectetur velit, eget eleifend neque hendrerit eu. Phasellus cursus aliquet dictum. Nam ullamcorper
                bibendum dapibus. Ut tempus, augue nec egestas imperdiet, sem enim rutrum sem, ut commodo erat nibh vel
                risus. In sed iaculis urna, ac blandit nisi.
              </p>
              <p>
                Sed facilisis ligula vitae rutrum laoreet. Vestibulum id ultricies turpis. Praesent fringilla est sed
                ornare dignissim. Donec lacinia commodo sapien ac interdum. Praesent ut tellus lorem. Morbi rutrum
                malesuada tincidunt. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus
                mus. Aliquam et consequat lacus.
              </p>
              <p>
                Donec nec viverra risus. Cras at eros vitae mauris elementum vestibulum. Sed porttitor lobortis sodales.
                Duis eleifend justo sed diam ullamcorper congue. Quisque accumsan sem sed urna laoreet, sed vehicula
                ipsum pretium. Proin mauris nisi, fermentum sit amet ligula a, maximus feugiat erat. Aenean interdum
                arcu ut nunc porta congue. Pellentesque volutpat interdum enim vitae laoreet. Nunc ligula ligula,
                fermentum nec libero ac, tincidunt convallis velit.
              </p>
            </section>

            {/* Footer */}
            <footer className="text-center text-sm text-muted-foreground pb-32">
              <p>© 2025 Glass Demo - Made with ❤️</p>
              <p>Scroll to see the glass effect in action!</p>
            </footer>
          </div>
        </div>
      </div>
    </GlassProvider>
  )
}

export default App
