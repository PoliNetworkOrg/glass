import { GlassLayer, GlassProvider } from "@polinetwork/glass"
import { ArrowDown, Blend, Eye, Layers, MousePointerClick, SlidersHorizontal, Sparkles, Zap } from "lucide-react"
import { useMemo, useState } from "react"
import { PagePicker } from "../router"
import { GlassButton, type GlassMode, modeProps, Segmented, ShowcaseContext, ShowGlass } from "./glass"

// A page on an animated background: blobs of colour that drift behind everything, blurred together, the way a landing
// page does it. Each blob is marked `glass-layer`, so the glass shows it where it is on every frame and not where it
// was when the page was captured. The switch turns that off (Not marked), to see the difference.

// `?worker=0` draws the glass on the page's frames instead of in a worker, as on the showcase
const worker = new URLSearchParams(window.location.search).get("worker") !== "0"

const BLOB_KEYFRAMES = `
@keyframes blob-a { 0%, 100% { transform: translate(0, 0) scale(1) } 50% { transform: translate(38vw, 22vh) scale(1.3) } }
@keyframes blob-b { 0%, 100% { transform: translate(0, 0) rotate(0deg) } 50% { transform: translate(-34vw, 30vh) rotate(160deg) } }
@keyframes blob-c { 0%, 100% { transform: translate(0, 0) scale(1.1) } 50% { transform: translate(20vw, -36vh) scale(0.8) } }
@keyframes blob-d { 0%, 100% { opacity: 0.9; scale: 1 } 50% { opacity: 0.35; scale: 1.4 } }
`

const blobs = [
  { color: "#7c3aed", size: "48vmax", left: "-12%", top: "-14%", animation: "blob-a 14s ease-in-out infinite" },
  { color: "#2563eb", size: "42vmax", left: "52%", top: "2%", animation: "blob-b 18s ease-in-out infinite" },
  { color: "#0d9488", size: "38vmax", left: "10%", top: "52%", animation: "blob-c 16s ease-in-out infinite" },
  { color: "#db2777", size: "30vmax", left: "62%", top: "58%", animation: "blob-d 9s ease-in-out infinite" },
]

function Blobs({ live }: { live: boolean }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ filter: "blur(90px) saturate(1.1)" }}
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
            opacity: 0.75,
            animation: blob.animation,
          }}
        />
      ))}
    </div>
  )
}

const features = [
  {
    icon: Zap,
    title: "Moves with the page",
    text: "Blobs drift under the glass at the frame rate of the page, not at the rate of a capture.",
  },
  {
    icon: Layers,
    title: "Text stays on top",
    text: "What the page has in front of its layers is drawn over them, so the copy under a card stays sharp.",
  },
  {
    icon: MousePointerClick,
    title: "Opt in",
    text: "Mark what moves with glass-layer. The rest of the page is captured as before.",
  },
  {
    icon: SlidersHorizontal,
    title: "Transforms and opacity",
    text: "What the compositor animates: translate, scale, rotate, and fades.",
  },
  {
    icon: Blend,
    title: "Filters folded in",
    text: "A box of blobs blurred together is drawn blurred, though each blob moves on its own.",
  },
  {
    icon: Eye,
    title: "Nothing to pay at rest",
    text: "Glass that no layer is under bends the page picture, as it always has.",
  },
]

const steps = [
  {
    title: "Mark the element that moves",
    text: "Add glass-layer to each blob. It is left out of the picture of the page.",
  },
  {
    title: "The layer gets a picture of its own",
    text: "Its filters and its ancestors' are folded in, without its animations.",
  },
  {
    title: "The glass reads it every frame",
    text: "Box, transform and opacity, then bends a backdrop built from what is under, the layers, and what is in front.",
  },
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

          <main className="mx-auto max-w-5xl space-y-24 px-4 pt-36 pb-40 sm:px-6">
            <section className="space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/70">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Animated backgrounds
              </span>
              <h1 className="max-w-3xl text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
                Glass over a background that{" "}
                <span className="bg-linear-to-r from-violet-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                  never sits still
                </span>
                .
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-white/70">
                The blobs behind this page are CSS animations. Each one is left out of the picture of the page and drawn
                by the glass where it is on every frame, under the text in front of it, which the glass keeps sharp.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <GlassButton
                  tone="blue"
                  className="px-6 py-3"
                  onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
                >
                  How it works
                  <ArrowDown className="size-4" />
                </GlassButton>
                <ShowGlass className="flex flex-wrap items-center gap-3 rounded-3xl p-3 sm:rounded-full sm:py-1.5 sm:pr-1.5 sm:pl-5">
                  <span className="text-sm font-medium text-white/80">Blobs</span>
                  <Segmented
                    options={[
                      { value: "on", label: "Marked" },
                      { value: "off", label: "Not marked" },
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
              </div>
            </section>

            <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <ShowGlass key={title} className="rounded-3xl p-6">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-2xl bg-white/12">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{text}</p>
                </ShowGlass>
              ))}
            </section>

            <section id="how" className="scroll-mt-28 space-y-8">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-widest text-white/50">How it works</p>
                <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                  One attribute, and the glass follows.
                </h2>
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                {steps.map((step, i) => (
                  <ShowGlass key={step.title} className="rounded-3xl p-6">
                    <span className="text-5xl font-bold tracking-tight text-white/25">0{i + 1}</span>
                    <h3 className="mt-3 text-lg font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{step.text}</p>
                  </ShowGlass>
                ))}
              </div>
              <ShowGlass className="rounded-3xl p-6 font-mono text-sm leading-relaxed text-white/85 sm:p-8">
                <span className="text-white/45">{"<"}</span>
                <span className="text-sky-300">div</span> <span className="text-violet-300">glass-layer</span>
                <span className="text-white/45">=</span>
                <span className="text-emerald-300">""</span> <span className="text-violet-300">className</span>
                <span className="text-white/45">=</span>
                <span className="text-emerald-300">"blob"</span> <span className="text-violet-300">style</span>
                <span className="text-white/45">={"{{"}</span> animation:{" "}
                <span className="text-emerald-300">"drift 14s ease-in-out infinite"</span>{" "}
                <span className="text-white/45">
                  {"}}"} /{">"}
                </span>
              </ShowGlass>
            </section>

            <section className="space-y-5 text-center">
              <p className="mx-auto max-w-xl text-white/60">
                Scroll back up and flip the switch to Not marked: the blobs lose their glass-layer and become part of
                the picture of the page and stay where they were when it was taken.
              </p>
              <GlassButton className="px-6 py-3" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Back to the top
              </GlassButton>
            </section>
          </main>
        </div>
      </GlassProvider>
    </ShowcaseContext.Provider>
  )
}
