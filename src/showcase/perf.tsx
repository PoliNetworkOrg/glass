import { GlassLayer } from "@polinetwork/glass"
import { Activity } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Segmented, ShowGlass } from "./glass"

type Stats = { fps: number; worst: number; glass: number; drawn: number }

/** Frames per second and the slowest frame over the last half second, and how much glass there is and is drawn in 3D */
function useStats() {
  const [stats, setStats] = useState<Stats>({ fps: 0, worst: 0, glass: 0, drawn: 0 })
  useEffect(() => {
    let frame = 0
    let frames = 0
    let worst = 0
    let start = performance.now()
    let last = start
    const tick = (now: number) => {
      frames++
      worst = Math.max(worst, now - last)
      last = now
      if (now - start >= 500) {
        setStats({
          fps: Math.round((frames * 1000) / (now - start)),
          worst: Math.round(worst),
          glass: document.querySelectorAll("._polinetwork_glass-content").length,
          drawn: document.querySelectorAll("._polinetwork_glass-content > canvas").length,
        })
        frames = 0
        worst = 0
        start = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return stats
}

const ORB_COUNTS = ["0", "8", "16", "32"] as const
export type OrbCount = (typeof ORB_COUNTS)[number]

/** The live numbers of the page, and the controls to load it */
export function PerfPanel({
  orbs,
  onOrbsChange,
  force3D,
  onForce3DChange,
  layered,
  onLayeredChange,
}: {
  orbs: OrbCount
  onOrbsChange: (orbs: OrbCount) => void
  force3D: boolean
  onForce3DChange: (force3D: boolean) => void
  layered: boolean
  onLayeredChange: (layered: boolean) => void
}) {
  const stats = useStats()
  // collapsed on a phone, where it would cover half the page
  const [open, setOpen] = useState(() => window.innerWidth >= 640)
  const smooth = stats.fps >= 55 && stats.worst < 34

  return (
    <div className="fixed top-20 right-3 z-40 w-[min(19rem,calc(100vw-1.5rem))]">
      <ShowGlass className="flex flex-col gap-3 rounded-3xl p-4 text-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left font-semibold"
          aria-expanded={open}
        >
          <Activity className="size-4" />
          Performance
          <span className="ml-auto flex items-center gap-1.5 font-mono text-xs font-normal tabular-nums">
            <span className={cn("size-2 rounded-full", smooth ? "bg-emerald-500" : "bg-amber-500")} />
            {stats.fps} fps
          </span>
        </button>
        {open && (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs opacity-60">Worst frame</dt>
                <dd className="font-mono tabular-nums">{stats.worst} ms</dd>
              </div>
              <div>
                <dt className="text-xs opacity-60">Glass</dt>
                <dd className="font-mono tabular-nums">{stats.glass}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-60">In 3D</dt>
                <dd className="font-mono tabular-nums">{stats.drawn}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs opacity-60">Moving glass orbs</span>
              <Segmented
                options={ORB_COUNTS.map((n) => ({ value: n, label: n }))}
                value={orbs}
                onChange={onOrbsChange}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span>
                Orbs over the glass
                <span className="block text-xs opacity-60">On the top layer, bending all the glass below</span>
              </span>
              <input
                type="checkbox"
                checked={layered}
                onChange={(e) => onLayeredChange(e.target.checked)}
                className="size-4 accent-sky-500"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span>
                Force 3D
                <span className="block text-xs opacity-60">Off follows the device check</span>
              </span>
              <input
                type="checkbox"
                checked={force3D}
                onChange={(e) => onForce3DChange(e.target.checked)}
                className="size-4 accent-sky-500"
              />
            </label>
          </>
        )}
      </ShowGlass>
    </div>
  )
}

// Each orb drifts on its own loop across the screen: moving glass is drawn again on every frame, which is the most
// the glass can be asked to do
const ORB_KEYFRAMES = `
@keyframes orb-drift-a { 0%, 100% { transform: translate(0, 0) } 25% { transform: translate(38vw, 12vh) } 50% { transform: translate(52vw, 54vh) } 75% { transform: translate(8vw, 40vh) } }
@keyframes orb-drift-b { 0%, 100% { transform: translate(0, 0) } 25% { transform: translate(-30vw, 30vh) } 50% { transform: translate(10vw, 60vh) } 75% { transform: translate(30vw, 10vh) } }
@keyframes orb-drift-c { 0%, 100% { transform: translate(0, 0) } 33% { transform: translate(24vw, -20vh) } 66% { transform: translate(-20vw, 24vh) } }
`

/**
 * @param layered On layer 2, above everything else, where they bend the header and the tab bar (layer 1) and the cards
 * (layer 0) as they pass over them. Otherwise on layer 0, under the header and the tab bar, bending only the page.
 */
export function Orbs({ count, layered }: { count: number; layered: boolean }) {
  if (count === 0) return null
  return (
    <GlassLayer layer={layered ? 2 : 0}>
      <div className={cn("pointer-events-none fixed inset-0 overflow-hidden", layered ? "z-[60]" : "z-30")} aria-hidden>
        <style>{ORB_KEYFRAMES}</style>
        {Array.from({ length: count }, (_, i) => {
          const size = 56 + ((i * 37) % 48)
          return (
            <ShowGlass
              // biome-ignore lint/suspicious/noArrayIndexKey: the orbs are only a count
              key={i}
              preset={i % 3 === 0 ? "regular" : "clear"}
              tone={i % 5 === 0 ? "blue" : "neutral"}
              className="rounded-full"
              style={{
                position: "absolute",
                width: size,
                height: size,
                left: `${(i * 23) % 80}%`,
                top: `${(i * 41) % 75}%`,
                animation: `orb-drift-${"abc"[i % 3]} ${9 + (i % 7)}s ease-in-out ${-i * 0.7}s infinite`,
              }}
            >
              {null}
            </ShowGlass>
          )
        })}
      </div>
    </GlassLayer>
  )
}
