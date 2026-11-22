import { Glass, glassColors, glassPresets, glassThemeTint, withPreset } from "@polinetwork/glass"
import { Cat, type LucideIcon, SlidersHorizontal, Sparkles } from "lucide-react"
import { useSyncExternalStore } from "react"
import { cn } from "@/lib/utils"
import { LENS_COLOR, lensOptions } from "./showcase/glass"

// The pages of the demo, in the hash, so that the static deploy needs no server routing

export type Route = "playground" | "showcase" | "ambient"

const pages: { route: Route; href: string; label: string; icon: LucideIcon }[] = [
  { route: "showcase", href: "#/", label: "Showcase", icon: Cat },
  { route: "ambient", href: "#/ambient", label: "Ambient", icon: Sparkles },
  { route: "playground", href: "#/playground", label: "Playground", icon: SlidersHorizontal },
]

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

// the showcase is the demo's front page, and `#/showcase`, where it was first, still leads to it
const read = (): Route => {
  const hash = window.location.hash.replace(/^#\/?/, "")
  return hash === "playground" || hash === "ambient" ? hash : "showcase"
}

export function useRoute() {
  return useSyncExternalStore(subscribe, read, () => "showcase" as const)
}

/**
 * Switches between the pages of the demo.
 *
 * @param lens It sits on another glass (the header of the showcase): slightly tinted, see `lensOptions`
 */
export function PagePicker({
  dark = false,
  force3D,
  disable3D,
  lens,
}: {
  dark?: boolean
  force3D?: boolean
  disable3D?: boolean
  lens?: boolean
}) {
  const route = useRoute()
  return (
    <Glass
      options={
        lens ? lensOptions(dark) : dark ? withPreset("regular", { tint: glassThemeTint.dark }) : glassPresets.regular
      }
      color={lens ? LENS_COLOR : dark ? glassColors.dark : glassColors.light}
      force3D={force3D}
      disable3D={disable3D}
      className={cn("flex gap-1 rounded-full p-1 text-sm font-medium", dark ? "text-white" : "text-slate-900")}
    >
      {/* On a phone the other pages are icons, so the picker leaves room for the rest of a header */}
      {pages.map(({ route: to, href, label, icon: Icon }) => {
        const current = route === to
        return (
          <a
            key={to}
            href={href}
            aria-current={current ? "page" : undefined}
            aria-label={label}
            title={label}
            className={cn(
              "flex items-center gap-1.5 rounded-full py-1.5 transition-colors",
              current ? "px-3" : "px-2.5 sm:px-3",
              current ? (dark ? "bg-white/15" : "bg-slate-900/10") : "opacity-70 hover:opacity-100"
            )}
          >
            {!current && <Icon className="size-4 sm:hidden" aria-hidden />}
            <span className={current ? undefined : "hidden sm:inline"}>{label}</span>
          </a>
        )
      })}
    </Glass>
  )
}
