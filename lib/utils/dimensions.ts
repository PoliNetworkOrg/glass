export interface ElementRect {
  top: number
  left: number
  width: number
  height: number
  right: number
  bottom: number
}

export function getElementRect(el: HTMLElement): ElementRect {
  const rect = el.getBoundingClientRect()
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop

  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft,
    width: rect.width,
    height: rect.height,
    right: rect.right + scrollLeft,
    bottom: rect.bottom + scrollTop,
  }
}
