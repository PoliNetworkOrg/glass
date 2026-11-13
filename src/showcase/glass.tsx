import {
  Glass,
  type GlassProps,
  glassColors,
  glassThemeTint,
  glassPresets,
  glassTints,
  withPreset,
} from "@polinetwork/glass"
import { createContext, type KeyboardEvent, useContext } from "react"
import { cn } from "@/lib/utils"

// The glass of the showcase: the same component the library exports, with the page's theme and the switch that
// forces the 3D glass on (to see it and measure it on a device the capability check would give the CSS glass to)

export type Tone = "neutral" | keyof typeof glassTints

/**
 * How the glass is drawn: `3d` always (to see it and measure it on a device the device check would give the CSS glass
 * to), `auto` as the device check decides, `css` always with the CSS fallback (to compare)
 */
export type GlassMode = "3d" | "auto" | "css"

/** What forcing the glass one way or the other takes, as props of a glass */
export const modeProps = (mode: GlassMode) => ({ force3D: mode === "3d", disable3D: mode === "css" })

export const ShowcaseContext = createContext<{ dark: boolean; mode: GlassMode }>({ dark: false, mode: "3d" })

/** Whether a glass is inside another one */
const NestedContext = createContext(false)

/**
 * Glass on glass: a lens, a knob, a button on a panel. The library draws it with the CSS glass, which blurs and tints
 * the glass under it, and it is only slightly tinted, white in both themes, so it reads as a lighter layer on it.
 */
export const lensOptions = (dark: boolean) =>
  withPreset("clear", {
    surface: { frost: 0.5 },
    tint: { opacity: dark ? 0.14 : 0.4, saturate: 1, lift: 1 },
    edge: { shadow: 0.5 },
  })
export const LENS_COLOR = "#ffffff"

type ShowGlassProps = Omit<GlassProps, "options" | "color"> & {
  tone?: Tone
  preset?: "regular" | "clear"
}

/** A glass in the theme of the page: neutral by default, or tinted with one of the system colors */
export function ShowGlass({ tone = "neutral", preset = "regular", className, children, ...rest }: ShowGlassProps) {
  const { dark, mode } = useContext(ShowcaseContext)
  const nested = useContext(NestedContext)
  const tinted = tone !== "neutral"
  const options = tinted
    ? glassPresets.tinted
    : nested
      ? lensOptions(dark)
      : preset === "regular" && dark
        ? withPreset("regular", { tint: glassThemeTint.dark })
        : glassPresets[preset]
  const color = tinted ? glassTints[tone] : nested ? LENS_COLOR : dark ? glassColors.dark : glassColors.light
  return (
    <Glass
      options={options}
      color={color}
      {...modeProps(mode)}
      className={cn(tinted || dark ? "text-white" : "text-slate-900", className)}
      {...rest}
    >
      <NestedContext.Provider value={true}>{children}</NestedContext.Provider>
    </Glass>
  )
}

const activate = (onClick?: () => void) => (e: KeyboardEvent) => {
  if (e.key !== "Enter" && e.key !== " ") return
  e.preventDefault()
  onClick?.()
}

type GlassButtonProps = ShowGlassProps & {
  onClick?: () => void
  /** What it does, for a button with only an icon */
  label?: string
  pressed?: boolean
}

/** A button made of glass: it lifts on hover, and snaps down, lights up and stretches when pressed */
export function GlassButton({ onClick, label, pressed, className, children, ...rest }: GlassButtonProps) {
  return (
    <ShowGlass
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      onKeyDown={activate(onClick)}
      interactive
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-full font-medium outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
        className
      )}
      {...rest}
    >
      {children}
    </ShowGlass>
  )
}

/**
 * A row of options with a lens that slides to the chosen one. The lens is glass on glass, so it is the slightly tinted
 * CSS glass (see `lensOptions`), and the browser keeps its backdrop in step as it moves.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { value: T; label: React.ReactNode; title?: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  const n = options.length
  return (
    <ShowGlass className={cn("flex rounded-full p-1", className)} role="group">
      <ShowGlass
        aria-hidden
        className="rounded-full"
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          width: `calc((100% - 8px) / ${n})`,
          left: `calc(4px + ${index} * (100% - 8px) / ${n})`,
          transition: "left 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
          zIndex: 0,
        }}
      >
        {null}
      </ShowGlass>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-[2] flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-opacity",
            option.value === value ? "opacity-100" : "opacity-60 hover:opacity-90"
          )}
        >
          {option.label}
        </button>
      ))}
    </ShowGlass>
  )
}
