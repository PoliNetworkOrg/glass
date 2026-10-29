// A picture of the page, for the glass to bend.
//
// It is drawn the way html-to-image did it, as an SVG image of a copy of the page, but the copy is styled differently.
// html-to-image wrote the computed style of every element on its copy, which in Chrome (it gives no computed cssText)
// is ~580 properties read one at a time per element: ~150ms of frozen page on the demo, and it grows with the page.
// Here the copy keeps its classes and gets the page's own stylesheets, so the browser styles it the way it styles the
// page, and what is left is a clone and a serialization.
//
// What the picture sees differently from the page, and what is done about it:
//   - an SVG image loads nothing, so images, fonts and the other urls are inlined as data urls (fetched once, kept)
//   - its viewport is the whole page, so viewport units are turned into px first, and <html> is given its width
//   - its `:root` is the <svg>, so rules on `:root` are made to match the copy of <html> too
//   - scripts don't run in it, so <noscript> would show and is taken out
//   - what the page draws by itself (canvas, video, iframes) and the scroll of inner scrollers aren't in it

const XHTML_NS = "http://www.w3.org/1999/xhtml"
const SVG_NS = "http://www.w3.org/2000/svg"

export type Snapshot = {
  /** The picture, which is smaller than the page where the page is bigger than a texture can be */
  canvas: HTMLCanvasElement
  /** The size of the page it shows, in CSS px */
  width: number
  height: number
}

/** url to its data url, fetched once */
const inlined = new Map<string, Promise<string | null>>()

function toDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return Promise.resolve(url)
  let data = inlined.get(url)
  if (!data) {
    data = fetch(url)
      .then((res) => (res.ok ? res.blob() : null))
      .then(
        (blob) =>
          blob &&
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
      )
      .catch(() => null)
    inlined.set(url, data)
  }
  return data
}

const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g

/** Inlines the urls in a piece of CSS, resolved against `base`. References to the document (`url(#id)`) stay. */
async function inlineUrls(css: string, base: string) {
  const urls = new Map<string, string>()
  for (const [, , raw] of css.matchAll(URL_RE)) {
    if (raw.startsWith("#") || raw.startsWith("data:")) continue
    try {
      urls.set(raw, new URL(raw, base).href)
    } catch {
      /* not a url */
    }
  }
  if (urls.size === 0) return css
  const data = new Map<string, string | null>()
  await Promise.all([...urls].map(async ([raw, href]) => data.set(raw, await toDataUrl(href))))
  return css.replace(URL_RE, (match, _quote, raw: string) => {
    const inline = data.get(raw)
    return inline ? `url("${inline}")` : match
  })
}

/** Viewport units of any kind (`100dvh`, `50vw`, `10vmin`) */
const VIEWPORT_RE = /(?<![\w-])(-?\d*\.?\d+)(s|l|d)?(vh|vw|vi|vb|vmin|vmax)\b/g

type Prefix = "" | "s" | "l" | "d"
/** px per viewport unit, for each of the plain, small, large and dynamic viewports, as [width, height] */
type ViewportUnits = Record<Prefix, readonly [number, number]>

let viewport: ViewportUnits = { "": [0, 0], s: [0, 0], l: [0, 0], d: [0, 0] }

/**
 * Measures what the viewport units are on the page, by sizing an element with them. Nothing the window says gives
 * them: `innerWidth` is the visual viewport, which a phone zoomed out to fit a page wider than its screen makes bigger
 * than the layout one the units are of, and the small, large and dynamic heights are where its toolbars stand.
 */
function measureViewport(): ViewportUnits {
  const probe = document.createElement("div")
  probe.style.cssText = "position: fixed; top: 0; left: 0; visibility: hidden; pointer-events: none;"
  document.body.append(probe)
  const size = (prefix: Prefix): [number, number] => {
    probe.style.width = "0"
    probe.style.height = "0"
    probe.style.width = `100${prefix}vw`
    probe.style.height = `100${prefix}vh`
    return [probe.offsetWidth / 100, probe.offsetHeight / 100]
  }
  const plain = size("")
  // a browser without the small, large and dynamic units has only the plain ones
  const or = ([w, h]: [number, number]) => [w || plain[0], h || plain[1]] as const
  const units = { "": plain, s: or(size("s")), l: or(size("l")), d: or(size("d")) }
  probe.remove()
  return units
}

/**
 * Viewport units in declarations turned into px. Only in declarations: a selector can hold what reads like one, as
 * Tailwind's `.h-\[72vh\]` does, and rewritten it would no longer match its class.
 */
function fixViewport(css: string) {
  return css.replace(VIEWPORT_RE, (_, n: string, prefix: Prefix | undefined, unit: string) => {
    const [vw, vh] = viewport[prefix ?? ""]
    const per =
      unit === "vw" || unit === "vi"
        ? vw
        : unit === "vh" || unit === "vb"
          ? vh
          : unit === "vmin"
            ? Math.min(vw, vh)
            : Math.max(vw, vh)
    return `${Number(n) * per}px`
  })
}

/** A selector of the page as the picture needs it: `:root` is its <svg>, so rules on `:root` match the copy of <html> too */
const fixSelector = (selector: string) => selector.replace(/:root\b/g, ":is(:root, html)")

/** The first source of a font, which is the one the browser would use: the rest are copies in other formats */
function firstSource(rule: CSSFontFaceRule) {
  const src = rule.style.getPropertyValue("src")
  const first = src.split(/,(?![^(]*\))/)[0]
  return first && first !== src ? rule.cssText.replace(src, first) : rule.cssText
}

const normalizeFamily = (family: string) => family.replace(/["']/g, "").trim()
const normalizeRange = (range: string) => range.replace(/\s/g, "").toUpperCase() || "U+0-10FFFF"

/**
 * The fonts the page has loaded, as `family|unicode-range`. A font face that isn't loaded isn't drawn anywhere on the
 * page, and inlining it (Google Fonts has dozens of subsets per family) would only make the picture heavier.
 */
function loadedFonts() {
  const loaded = new Set<string>()
  for (const face of document.fonts) {
    if (face.status === "loaded") loaded.add(`${normalizeFamily(face.family)}|${normalizeRange(face.unicodeRange)}`)
  }
  return loaded
}

function rulesText(rules: CSSRuleList, fonts: Set<string>): string {
  let text = ""
  for (const rule of rules) {
    if (rule instanceof CSSImportRule) {
      // the sheet it imports, in its place
      const sheet = rule.styleSheet
      if (sheet) text += `${safeRules(sheet, fonts)}\n`
    } else if (rule instanceof CSSFontFaceRule) {
      const key = `${normalizeFamily(rule.style.getPropertyValue("font-family"))}|${normalizeRange(rule.style.getPropertyValue("unicode-range"))}`
      if (fonts.has(key)) text += `${firstSource(rule)}\n`
    } else {
      text += `${ruleText(rule, fonts)}\n`
    }
  }
  return text
}

/**
 * Media queries, decided on the page. The picture is an SVG image with its own media: it is as wide as everything on
 * the page and has no scrollbar, so a window just past a breakpoint by less than its scrollbar is under it in the
 * picture, and the picture is laid out for another screen (a gallery of one column for one of two). Each `@media` is
 * asked of the page instead, and what holds goes in as it is, without the query.
 */
const mediaLists = new Map<string, MediaQueryList>()
function mediaMatches(query: string) {
  if (!query || query === "all") return true
  let list = mediaLists.get(query)
  if (!list) {
    list = window.matchMedia(query)
    mediaLists.set(query, list)
  }
  return list.matches
}
/** What the media queries met so far say now: when it changes, the CSS made with them is out of date */
const mediaKey = () => [...mediaLists.values()].map((list) => (list.matches ? 1 : 0)).join("")

/** What comes before the block of a rule: its selector, or its `@media (...)` */
const prelude = (rule: CSSRule) => rule.cssText.slice(0, rule.cssText.indexOf("{")).trim()

/** A rule with the viewport units of its declarations turned into px, and those of the rules inside it */
function ruleText(rule: CSSRule, fonts: Set<string>): string {
  if (rule instanceof CSSStyleRule) {
    // a style rule can hold nested rules too
    const nested = rule.cssRules.length > 0 ? rulesText(rule.cssRules, fonts) : ""
    return `${fixSelector(rule.selectorText)} { ${fixViewport(rule.style.cssText)} ${nested}}`
  }
  if (rule instanceof CSSKeyframesRule) {
    const frames = [...rule.cssRules].map((frame) =>
      frame instanceof CSSKeyframeRule ? `${frame.keyText} { ${fixViewport(frame.style.cssText)} }` : frame.cssText
    )
    return `${prelude(rule)} { ${frames.join(" ")} }`
  }
  if (rule instanceof CSSMediaRule) return mediaMatches(rule.media.mediaText) ? rulesText(rule.cssRules, fonts) : ""
  // @supports, @layer, @container: their prelude as it is
  if (rule instanceof CSSGroupingRule) return `${prelude(rule)} {\n${rulesText(rule.cssRules, fonts)}}`
  return rule.cssText
}

function safeRules(sheet: CSSStyleSheet, fonts: Set<string>) {
  try {
    return rulesText(sheet.cssRules, fonts)
  } catch {
    return ""
  }
}

/** The text of the stylesheets another origin doesn't let the page read, fetched once */
const fetched = new Map<string, Promise<string>>()

/** The CSS of each stylesheet as the picture needs it, kept until the sheet, the fonts or the viewport change */
const prepared = new WeakMap<CSSStyleSheet, { key: string; css: Promise<string> }>()

function prepare(sheet: CSSStyleSheet, fonts: Set<string>, fontsKey: string): Promise<string> {
  if (sheet.disabled || !mediaMatches(sheet.media.mediaText)) return Promise.resolve("")
  let rules: CSSRuleList | null = null
  try {
    rules = sheet.cssRules
  } catch {
    /* another origin's */
  }
  const key = `${rules?.length ?? "x"}|${fontsKey}|${JSON.stringify(viewport)}|${mediaKey()}`
  const cached = prepared.get(sheet)
  if (cached?.key === key) return cached.css

  const base = sheet.href ?? document.baseURI
  let raw: Promise<string>
  if (rules) raw = Promise.resolve(rulesText(rules, fonts))
  else if (sheet.href) {
    const href = sheet.href
    let text = fetched.get(href)
    if (!text) {
      text = fetch(href)
        .then((res) => (res.ok ? res.text() : ""))
        .catch(() => "")
      fetched.set(href, text)
    }
    // without its rules there is no telling a selector from a declaration: a sheet another origin hosts is hardly
    // made of utility classes, and is rewritten whole
    raw = text.then((css) => fixSelector(fixViewport(css)))
  } else raw = Promise.resolve("")

  // the urls after the viewport units: the data urls could hold something that reads like one
  const css = raw.then((text) => inlineUrls(text, base))
  prepared.set(sheet, { key, css })
  return css
}

/** All of the page's CSS */
async function pageCss() {
  const fonts = loadedFonts()
  const fontsKey = [...fonts].sort().join(",")
  const sheets = [...document.styleSheets, ...document.adoptedStyleSheets]
  const parts = await Promise.all(sheets.map((sheet) => prepare(sheet, fonts, fontsKey)))
  // the glass doesn't see itself, nor anything marked to be left out, but they keep their place in the layout
  parts.push("[glass-ignore], [glass-ignore] * { visibility: hidden !important; }")
  return parts.join("\n")
}

const isTransparent = (color: string) => color === "transparent" || /\/\s*0\)$|,\s*0\)$/.test(color)

/**
 * The colors the page is painted on, bottom first: the browser's canvas (white, or dark under a dark color scheme),
 * and the background of <html>, or of <body> where <html> has none. CSS spreads that one over the whole canvas, past
 * the box of either, which the copy in the picture can't do: where the page is wider or taller than its <html> (a
 * phone, with something overflowing it) the picture would be empty there, and the glass would show it gray.
 */
function canvasColors() {
  const probe = document.createElement("div")
  probe.style.cssText = "position: absolute; visibility: hidden; background-color: Canvas;"
  document.documentElement.append(probe)
  const colors = [getComputedStyle(probe).backgroundColor]
  probe.remove()
  const root = [document.documentElement, document.body]
    .map((el) => getComputedStyle(el).backgroundColor)
    .find((color) => !isTransparent(color))
  if (root) colors.push(root)
  return colors
}

/** The biggest texture this device takes, and so the biggest the picture can be */
let maxTexture = 0
function maxTextureSize() {
  if (!maxTexture) {
    const gl = document.createElement("canvas").getContext("webgl")
    maxTexture = Math.min(16384, gl?.getParameter(gl.MAX_TEXTURE_SIZE) ?? 4096)
    gl?.getExtension("WEBGL_lose_context")?.loseContext()
  }
  return maxTexture
}

/** Puts on the copy what the page holds in properties and not in its markup: images as they loaded, form values */
async function copyState(page: HTMLElement, copy: HTMLElement) {
  // a clone has the same elements in the same order, so the nth match in one is the nth in the other
  const pageImages = page.querySelectorAll("img")
  const copyImages = copy.querySelectorAll("img")
  const images = [...pageImages].map(async (img, i) => {
    const clone = copyImages[i]
    clone.removeAttribute("srcset")
    clone.removeAttribute("sizes")
    clone.removeAttribute("loading")
    const src = img.currentSrc || img.src
    // an image that the page hasn't loaded (a lazy one far below) isn't drawn on it either
    const data = src && img.complete && !img.closest("[glass-ignore]") ? await toDataUrl(src) : null
    if (data) clone.setAttribute("src", data)
    else clone.removeAttribute("src")
  })

  const pageSvgImages = page.querySelectorAll("image")
  const copySvgImages = copy.querySelectorAll("image")
  const svgImages = [...pageSvgImages].map(async (image, i) => {
    const href = image.href.baseVal
    if (!href) return
    const data = await toDataUrl(new URL(href, document.baseURI).href)
    if (data) copySvgImages[i].setAttribute("href", data)
  })

  const pageFields = page.querySelectorAll("input, textarea, select")
  const copyFields = copy.querySelectorAll("input, textarea, select")
  pageFields.forEach((field, i) => {
    const clone = copyFields[i]
    if (field instanceof HTMLInputElement) {
      if (field.type === "checkbox" || field.type === "radio") clone.toggleAttribute("checked", field.checked)
      else clone.setAttribute("value", field.value)
    } else if (field instanceof HTMLTextAreaElement) {
      clone.textContent = field.value
    } else if (field instanceof HTMLSelectElement) {
      const options = clone.querySelectorAll("option")
      for (const [j, option] of [...field.options].entries()) options[j]?.toggleAttribute("selected", option.selected)
    }
  })

  // inline styles have urls and viewport units too
  const styled = [...copy.querySelectorAll<HTMLElement>("[style]")].map(async (el) => {
    const style = el.getAttribute("style") ?? ""
    if (!/url\(|v[hwib]\b|vmin|vmax/.test(style)) return
    el.setAttribute("style", await inlineUrls(fixViewport(style), document.baseURI))
  })

  await Promise.all([...images, ...svgImages, ...styled])
}

/**
 * Takes a picture of the whole page.
 *
 * @param blur Blur of the picture, in px
 * @returns The picture, and the size of the page it shows
 */
export async function snapshot(blur = 0): Promise<Snapshot> {
  const page = document.documentElement
  const width = page.scrollWidth
  const height = page.scrollHeight

  viewport = measureViewport()

  const copy = page.cloneNode(true) as HTMLElement
  // the picture is as wide as everything on the page, which is wider than the page itself where something overflows
  // it: the copy of <html> keeps the width of the page, or what is centered or wraps in it would be laid out wider
  copy.style.width = getComputedStyle(page).width
  const [css] = await Promise.all([pageCss(), copyState(page, copy)])

  // what the page styles with is replaced by its CSS in one sheet, and what only matters to a live page is dropped
  for (const el of copy.querySelectorAll('script, noscript, style, link[rel~="stylesheet"]')) el.remove()
  const style = document.createElementNS(XHTML_NS, "style")
  style.textContent = css
  const head = copy.querySelector("head")
  if (head) head.replaceChildren(style)
  else copy.prepend(style)
  if (blur) copy.style.filter = `blur(${blur}px)`

  const svg =
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${new XMLSerializer().serializeToString(copy)}</foreignObject>` +
    "</svg>"

  // a data url and not a blob one: Chrome taints a canvas that draws an SVG with a foreignObject from a blob, and a
  // tainted canvas can't be a texture
  const img = new Image()
  img.decoding = "async"
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()

  // a page bigger than a texture can be is drawn smaller, and stretched back to its size when it is drawn
  const scale = Math.min(1, maxTextureSize() / width, maxTextureSize() / height)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.floor(width * scale))
  canvas.height = Math.max(1, Math.floor(height * scale))
  const ctx = canvas.getContext("2d")
  if (ctx) {
    for (const color of canvasColors()) {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  return { canvas, width, height }
}
