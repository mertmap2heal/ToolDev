import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null
  )
}

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, isActive: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    previousFocusRef.current = document.activeElement as HTMLElement | null
    const container = containerRef.current
    const focusables = getFocusables(container)
    const first = focusables[0]
    if (first) {
      first.focus()
    } else {
      container.focus({ preventScroll: true })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const f = getFocusables(container)
      if (f.length === 0) return
      const fst = f[0]
      const lst = f[f.length - 1]
      const current = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (current === fst) {
          e.preventDefault()
          lst.focus()
        }
      } else {
        if (current === lst) {
          e.preventDefault()
          fst.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isActive, containerRef])
}
