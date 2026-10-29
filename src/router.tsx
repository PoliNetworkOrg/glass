import { Glass, glassColors, glassPresets } from "@polinetwork/glass"
import { useSyncExternalStore } from "react"
import { cn } from "@/lib/utils"
import { LENS_COLOR, lensOptions } from "./showcase/glass"

// The pages of the demo, in the hash, so that the static deploy needs no server routing

export type Route = "playground" | "showcase"

const pages: { route: Route; href: string; label: string }[] = [
  { route: "playground", href: "#/", label: "Playground" },
  { route: "showcase", href: "#/showcase", label: "Showcase" },
]

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

const read = (): Route => (window.location.hash.replace(/^#\/?/, "") === "showcase" ? "showcase" : "playground")

export function useRoute() {
  return useSyncExternalStore(subscribe, read, () => "playground" as const)
}

/**
 * Switches between the pages of the demo.
 *
 * @param lens It sits on another glass (the header of the showcase): slightly tinted, see `lensOptions`
 */
export function PagePicker({ dark = false, force3D, lens }: { dark?: boolean; force3D?: boolean; lens?: boolean }) {
  const route = useRoute()
  return (
    <Glass
      options={lens ? lensOptions(dark) : glassPresets.regular}
      color={lens ? LENS_COLOR : dark ? glassColors.dark : glassColors.light}
      force3D={force3D}
      className={cn("flex gap-1 rounded-full p-1 text-sm font-medium", dark ? "text-white" : "text-slate-900")}
    >
      {pages.map((page) => (
        <a
          key={page.route}
          href={page.href}
          aria-current={route === page.route ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 transition-colors",
            route === page.route ? (dark ? "bg-white/15" : "bg-slate-900/10") : "opacity-70 hover:opacity-100"
          )}
        >
          {page.label}
        </a>
      ))}
    </Glass>
  )
}
