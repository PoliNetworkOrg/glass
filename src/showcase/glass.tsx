import { Glass, type GlassProps, glassColors, glassPresets, glassTints } from "@polinetwork/glass"
import { createContext, type KeyboardEvent, useContext } from "react"
import { cn } from "@/lib/utils"

// The glass of the showcase: the same component the library exports, with the page's theme and the switch that
// forces the 3D glass on (to see it and measure it on a device the capability check would give the CSS glass to)

export type Tone = "neutral" | keyof typeof glassTints

export const ShowcaseContext = createContext({ dark: false, force3D: true })

type ShowGlassProps = Omit<GlassProps, "options" | "color"> & {
  tone?: Tone
  preset?: "regular" | "clear"
}

/** A glass in the theme of the page: neutral by default, or tinted with one of the system colors */
export function ShowGlass({ tone = "neutral", preset = "regular", className, ...rest }: ShowGlassProps) {
  const { dark, force3D } = useContext(ShowcaseContext)
  const tinted = tone !== "neutral"
  return (
    <Glass
      options={tinted ? glassPresets.tinted : glassPresets[preset]}
      color={tinted ? glassTints[tone] : dark ? glassColors.dark : glassColors.light}
      force3D={force3D}
      className={cn(tinted || dark ? "text-white" : "text-slate-900", className)}
      {...rest}
    />
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
 * A row of options with a glass lens that slides to the chosen one. The lens moves by its `left`, a change of layout
 * the glass follows on every frame, so it bends what is under it all the way.
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
