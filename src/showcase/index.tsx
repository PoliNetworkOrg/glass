import { GlassProvider } from "@polinetwork/glass"
import {
  Aperture,
  ArrowRight,
  Bookmark,
  ChevronRight,
  Compass,
  Heart,
  House,
  Moon,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sun,
  User,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { PagePicker } from "../router"
import { GlassButton, Segmented, ShowcaseContext, ShowGlass } from "./glass"
import { type OrbCount, Orbs, PerfPanel } from "./perf"
import { gallery, moods, photos } from "./photos"

// A page made with the glass, the way an app would use it: a floating header, controls over photos, a player, a tab
// bar. It is also the place to see what the glass costs, with as much of it on screen as a real page has, and more.

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })

const sections = [
  { id: "explore", label: "Explore" },
  { id: "stories", label: "Stories" },
  { id: "listen", label: "Listen" },
  { id: "settings", label: "Settings" },
]

function Header({ dark, onDarkChange }: { dark: boolean; onDarkChange: (dark: boolean) => void }) {
  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
      <ShowGlass className="flex w-full max-w-4xl items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <Aperture className="size-5" />
          Lumen
        </button>
        <nav className="ml-4 hidden gap-1 md:flex">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToId(section.id)}
              className="rounded-full px-3 py-1.5 text-sm opacity-75 transition-opacity hover:opacity-100"
            >
              {section.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ShowcaseContext.Consumer>
            {({ force3D }) => <PagePicker dark={dark} force3D={force3D} lens />}
          </ShowcaseContext.Consumer>
          <GlassButton
            label={dark ? "Light theme" : "Dark theme"}
            onClick={() => onDarkChange(!dark)}
            claimTouch
            className="size-9"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </GlassButton>
        </div>
      </ShowGlass>
    </div>
  )
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-sm font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="text-muted-foreground">{text}</p>
    </div>
  )
}

function Hero() {
  const [saved, setSaved] = useState(false)
  return (
    <section className="relative">
      <img
        src={photos.clouds(1600)}
        alt="Mountain peaks above a sea of clouds at sunrise"
        className="h-[72vh] min-h-[460px] w-full rounded-[2rem] object-cover"
      />
      <ShowGlass
        preset="clear"
        className="rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
        style={{ position: "absolute", top: 20, left: 20 }}
      >
        Photo of the week
      </ShowGlass>
      <ShowGlass className="max-w-md rounded-3xl p-6" style={{ position: "absolute", left: 20, right: 20, bottom: 20 }}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Featured story</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Above the clouds</h1>
        <p className="mt-2 opacity-80">
          Four days on a ridge where the weather sits below you: the route, the gear, and the light that made the climb
          worth it.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <GlassButton tone="blue" className="px-5 py-2.5" onClick={() => scrollToId("stories")}>
            Read the story
            <ArrowRight className="size-4" />
          </GlassButton>
          <GlassButton className="px-5 py-2.5" pressed={saved} onClick={() => setSaved((s) => !s)}>
            <Bookmark className={cn("size-4", saved && "fill-current")} />
            {saved ? "Saved" : "Save"}
          </GlassButton>
        </div>
      </ShowGlass>
    </section>
  )
}

type Mood = "All" | (typeof moods)[number]

function Explore({ mood, onMoodChange }: { mood: Mood; onMoodChange: (mood: Mood) => void }) {
  return (
    <section id="explore" className="scroll-mt-24 space-y-6">
      <SectionTitle
        eyebrow="Explore"
        title="Find your light"
        text="Pick a mood and the stories below follow it. The chips are glass over a photo of stage lights, the hardest kind of background for glass to stay readable on."
      />
      <div className="relative">
        <img
          src={photos.concert(1600, 600)}
          alt="Stage lights and confetti over a concert crowd"
          className="h-64 w-full rounded-[2rem] object-cover"
        />
        <div className="absolute inset-0 flex flex-wrap content-center justify-center gap-3 p-6">
          {(["All", ...moods] as const).map((m) => (
            <GlassButton
              key={m}
              preset="clear"
              tone={m === mood ? "blue" : "neutral"}
              pressed={m === mood}
              onClick={() => onMoodChange(m)}
              className="px-4 py-2 text-sm"
            >
              {m}
            </GlassButton>
          ))}
        </div>
      </div>
    </section>
  )
}

function Stories({ mood }: { mood: Mood }) {
  const [liked, setLiked] = useState<Set<string>>(() => new Set())
  const shown = mood === "All" ? gallery : gallery.filter((photo) => photo.tag === mood)
  const toggle = (id: string) =>
    setLiked((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <section id="stories" className="scroll-mt-24 space-y-6">
      <SectionTitle
        eyebrow="Stories"
        title={mood === "All" ? "Latest stories" : `${mood} stories`}
        text="Every card carries two pieces of glass: a caption bar and a like button, both bending the photo they sit on."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((photo) => {
          const isLiked = liked.has(photo.id)
          return (
            <figure key={photo.id} className="relative">
              <img src={photo.src} alt={photo.title} className="aspect-[4/3] w-full rounded-3xl object-cover" />
              <GlassButton
                label={isLiked ? `Unlike ${photo.title}` : `Like ${photo.title}`}
                pressed={isLiked}
                onClick={() => toggle(photo.id)}
                className="size-10"
                style={{ position: "absolute", top: 12, right: 12 }}
              >
                <Heart className={cn("size-4", isLiked && "fill-red-500 text-red-500")} />
              </GlassButton>
              <ShowGlass
                className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}
              >
                <figcaption>
                  <div className="font-semibold">{photo.title}</div>
                  <div className="text-xs opacity-70">
                    {photo.count} photos · {photo.tag}
                  </div>
                </figcaption>
                <ChevronRight className="size-4 opacity-70" />
              </ShowGlass>
            </figure>
          )
        })}
      </div>
    </section>
  )
}

const TRACK_SECONDS = 221

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

function Listen() {
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(84)
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setPosition((p) => (p + 1) % TRACK_SECONDS), 1000)
    return () => clearInterval(timer)
  }, [playing])

  return (
    <section id="listen" className="scroll-mt-24 space-y-6">
      <SectionTitle
        eyebrow="Listen"
        title="Music for the long drive"
        text="A player floating over its own album art, with glass controls on glass."
      />
      <div className="relative">
        <img
          src={photos.turntable(1600, 700)}
          alt="Hands on a DJ deck lit in purple"
          className="h-[440px] w-full rounded-[2rem] object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <ShowGlass className="w-full max-w-sm rounded-[1.75rem] p-5">
            <div className="flex items-center gap-4">
              <img
                src={photos.crowd(200, 200)}
                alt="A singer in stage smoke"
                className="size-16 rounded-2xl object-cover"
              />
              <div>
                <div className="font-semibold">Night Drive</div>
                <div className="text-sm opacity-70">Lumen Sessions · Vol. 3</div>
              </div>
            </div>
            <div className="mt-5 h-1.5 rounded-full bg-current/15">
              <div
                className="h-full rounded-full bg-current/70"
                style={{ width: `${(position / TRACK_SECONDS) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-xs tabular-nums opacity-70">
              <span>{time(position)}</span>
              <span>-{time(TRACK_SECONDS - position)}</span>
            </div>
            <div className="mt-4 flex items-center justify-center gap-4">
              <GlassButton label="Previous" className="size-11" onClick={() => setPosition(0)}>
                <SkipBack className="size-4 fill-current" />
              </GlassButton>
              <GlassButton
                label={playing ? "Pause" : "Play"}
                tone="blue"
                className="size-14"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
              </GlassButton>
              <GlassButton
                label="Next"
                className="size-11"
                onClick={() => setPosition((p) => Math.min(TRACK_SECONDS - 1, p + 30))}
              >
                <SkipForward className="size-4 fill-current" />
              </GlassButton>
            </div>
          </ShowGlass>
        </div>
      </div>
    </section>
  )
}

/** A switch whose knob is a lens of glass that slides across a track of glass */
function GlassSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="shrink-0 rounded-full"
    >
      <ShowGlass tone={checked ? "green" : "neutral"} className="h-7 w-12 rounded-full">
        <ShowGlass
          preset="clear"
          className="rounded-full"
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            width: 22,
            height: 22,
            transition: "left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {null}
        </ShowGlass>
      </ShowGlass>
    </button>
  )
}

function Settings() {
  const [range, setRange] = useState<"day" | "week" | "month">("week")
  const [captions, setCaptions] = useState(true)
  const [autoplay, setAutoplay] = useState(false)
  return (
    <section id="settings" className="scroll-mt-24 space-y-6">
      <SectionTitle
        eyebrow="Settings"
        title="Controls that move"
        text="The lens of the segmented control and the knobs of the switches are glass on glass: a lightly tinted layer that slides over the panel, blurring and tinting it as it goes."
      />
      <div className="relative">
        <img
          src={photos.underwater(1600, 700)}
          alt="Light and bubbles under the surface of the sea"
          className="h-[440px] w-full rounded-[2rem] object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <ShowGlass className="w-full max-w-md space-y-5 rounded-[1.75rem] p-5">
            <div className="space-y-2">
              <div className="font-semibold">Highlights from the last</div>
              <Segmented
                options={[
                  { value: "day", label: "Day" },
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                ]}
                value={range}
                onChange={setRange}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">Captions on photos</div>
                <div className="text-sm opacity-70">Show the place and the date</div>
              </div>
              <GlassSwitch checked={captions} onChange={setCaptions} label="Captions on photos" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">Play videos by themselves</div>
                <div className="text-sm opacity-70">Only on Wi-Fi</div>
              </div>
              <GlassSwitch checked={autoplay} onChange={setAutoplay} label="Play videos by themselves" />
            </div>
          </ShowGlass>
        </div>
      </div>
    </section>
  )
}

const tabs = [
  { value: "home", label: "Home", icon: House, target: null },
  { value: "explore", label: "Explore", icon: Compass, target: "explore" },
  { value: "saved", label: "Saved", icon: Heart, target: "stories" },
  { value: "you", label: "You", icon: User, target: "settings" },
] as const

function TabBar() {
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("home")
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
      <Segmented
        className="w-[min(24rem,100%)]"
        options={tabs.map(({ value, label, icon: Icon }) => ({
          value,
          title: label,
          label: (
            <span className="flex flex-col items-center gap-0.5 py-0.5 text-[11px]">
              <Icon className="size-5" />
              {label}
            </span>
          ),
        }))}
        value={tab}
        onChange={(value) => {
          setTab(value)
          const target = tabs.find((t) => t.value === value)?.target
          if (target) scrollToId(target)
          else window.scrollTo({ top: 0, behavior: "smooth" })
        }}
      />
    </div>
  )
}

export function Showcase() {
  const [dark, setDark] = useState(false)
  const [force3D, setForce3D] = useState(true)
  const [orbs, setOrbs] = useState<OrbCount>("0")
  const [mood, setMood] = useState<Mood>("All")
  const context = useMemo(() => ({ dark, force3D }), [dark, force3D])

  return (
    <ShowcaseContext.Provider value={context}>
      <GlassProvider deps={[dark, mood]}>
        <div className={dark ? "dark" : ""}>
          <div className="min-h-screen bg-background text-foreground">
            <Header dark={dark} onDarkChange={setDark} />
            <main className="mx-auto max-w-6xl space-y-24 px-4 pt-24 pb-40 sm:px-6">
              <Hero />
              <Explore mood={mood} onMoodChange={setMood} />
              <Stories mood={mood} />
              <Listen />
              <Settings />
              <footer className="text-center text-sm text-muted-foreground">
                Lumen is a made up magazine, to show the glass of @polinetwork/glass on a real page. Photos from
                Unsplash.
              </footer>
            </main>
            <TabBar />
            <PerfPanel orbs={orbs} onOrbsChange={setOrbs} force3D={force3D} onForce3DChange={setForce3D} />
            <Orbs count={Number(orbs)} />
          </div>
        </div>
      </GlassProvider>
    </ShowcaseContext.Provider>
  )
}
