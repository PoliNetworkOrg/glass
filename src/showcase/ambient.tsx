import { GlassLayer, GlassProvider } from "@polinetwork/glass"
import { Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { PagePicker } from "../router"
import { GlassButton, type GlassMode, modeProps, Segmented, ShowcaseContext, ShowGlass } from "./glass"

// A page on an animated background: blobs of colour that drift behind everything, blurred together, the way a landing
// page does it. Each blob is marked `glass-layer`, so the glass shows it where it is on every frame and not where it
// was when the page was captured. The switch at the top turns that off, to see the difference.

// `?worker=1` draws the glass in a worker (experimental), as on the showcase
const worker = new URLSearchParams(window.location.search).get("worker") === "1"

const BLOB_KEYFRAMES = `
@keyframes blob-a { 0%, 100% { transform: translate(0, 0) scale(1) } 50% { transform: translate(38vw, 22vh) scale(1.3) } }
@keyframes blob-b { 0%, 100% { transform: translate(0, 0) rotate(0deg) } 50% { transform: translate(-34vw, 30vh) rotate(160deg) } }
@keyframes blob-c { 0%, 100% { transform: translate(0, 0) scale(1.1) } 50% { transform: translate(20vw, -36vh) scale(0.8) } }
@keyframes blob-d { 0%, 100% { opacity: 0.9; scale: 1 } 50% { opacity: 0.35; scale: 1.4 } }
`

const blobs = [
  { color: "#ff3d7f", size: "46vmax", left: "-8%", top: "-10%", animation: "blob-a 14s ease-in-out infinite" },
  { color: "#3d7bff", size: "40vmax", left: "55%", top: "5%", animation: "blob-b 18s ease-in-out infinite" },
  { color: "#20d3a8", size: "36vmax", left: "15%", top: "55%", animation: "blob-c 16s ease-in-out infinite" },
  { color: "#ffb020", size: "30vmax", left: "62%", top: "60%", animation: "blob-d 9s ease-in-out infinite" },
]

function Blobs({ live }: { live: boolean }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ filter: "blur(70px)" }}
      aria-hidden
    >
      <style>{BLOB_KEYFRAMES}</style>
      {blobs.map((blob) => (
        <div
          key={blob.color}
          // the attribute is all it takes: the glass draws the blob where it is on every frame
          {...(live ? { "glass-layer": "" } : {})}
          className="absolute rounded-full"
          style={{
            width: blob.size,
            height: blob.size,
            left: blob.left,
            top: blob.top,
            background: blob.color,
            opacity: 0.9,
            animation: blob.animation,
          }}
        />
      ))}
    </div>
  )
}

const features = [
  {
    title: "Moves with the page",
    text: "Blobs drift under the glass at the frame rate of the page, not at the rate of a capture.",
  },
  {
    title: "Text stays on top",
    text: "What the page has in front of its layers is drawn over them, so the copy under a card stays sharp.",
  },
  { title: "Opt in", text: "Mark what moves with glass-layer. The rest of the page is captured as before." },
  { title: "Transforms and opacity", text: "What the compositor animates: translate, scale, rotate, and fades." },
  {
    title: "Filters folded in",
    text: "A box of blobs blurred together is drawn blurred, though each blob moves on its own.",
  },
  { title: "Nothing to pay at rest", text: "Glass that no layer is under bends the page picture, as it always has." },
]

export function Ambient() {
  const [live, setLive] = useState(true)
  const [mode, setMode] = useState<GlassMode>("3d")
  const context = useMemo(() => ({ dark: true, mode }), [mode])

  return (
    <ShowcaseContext.Provider value={context}>
      <GlassProvider deps={[live]} worker={worker}>
        <div className="dark relative isolate min-h-screen bg-[#0b0d1a] text-white">
          <Blobs live={live} />
          <GlassLayer layer={1}>
            <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
              <ShowGlass className="flex w-full max-w-4xl items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4">
                <Sparkles className="size-5" />
                <span className="font-semibold tracking-tight">Ambient</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <PagePicker dark {...modeProps(mode)} lens />
                </div>
              </ShowGlass>
            </div>
          </GlassLayer>

          <main className="mx-auto max-w-5xl space-y-16 px-4 pt-32 pb-40 sm:px-6">
            <section className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Animated backgrounds</p>
              <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-7xl">
                Glass over a background that never sits still.
              </h1>
              <p className="max-w-2xl text-lg text-white/75">
                The blobs behind this page are CSS animations. Each one is left out of the picture of the page and drawn
                by the glass where it is on every frame, under the text in front of it, which the glass keeps sharp.
              </p>
              <ShowGlass className="flex max-w-xl flex-wrap items-center gap-3 rounded-3xl p-4">
                <span className="text-sm font-medium">Blobs as layers</span>
                <Segmented
                  options={[
                    { value: "on", label: "Live" },
                    { value: "off", label: "Captured" },
                  ]}
                  value={live ? "on" : "off"}
                  onChange={(value) => setLive(value === "on")}
                />
                <Segmented
                  options={[
                    { value: "3d", label: "3D" },
                    { value: "css", label: "CSS" },
                  ]}
                  value={mode === "css" ? "css" : "3d"}
                  onChange={(value) => setMode(value as GlassMode)}
                />
              </ShowGlass>
            </section>

            <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <ShowGlass key={feature.title} className="rounded-3xl p-6">
                  <h2 className="text-lg font-semibold">{feature.title}</h2>
                  <p className="mt-2 text-sm text-white/75">{feature.text}</p>
                </ShowGlass>
              ))}
            </section>

            <section className="space-y-4 text-white/70">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of filler
                <p key={i} className="max-w-2xl">
                  Scroll to see the fixed header pass over the copy and the cards. The header is glass on a higher
                  layer, so it bends the cards below it as they are drawn, and the blobs drift under all of it. With the
                  switch on Captured the blobs are part of the picture of the page and stay where they were when it was
                  taken.
                </p>
              ))}
            </section>

            <section className="flex justify-center">
              <GlassButton
                tone="blue"
                className="px-6 py-3"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Back to the top
              </GlassButton>
            </section>
          </main>
        </div>
      </GlassProvider>
    </ShowcaseContext.Provider>
  )
}
