"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface UseResizablePanelOptions {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** Handle on the panel's trailing edge; drag right to widen. */
  edge?: "start" | "end"
  disabled?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function readStoredWidth(
  storageKey: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
) {
  if (typeof window === "undefined") return defaultWidth
  const stored = window.localStorage.getItem(storageKey)
  if (!stored) return defaultWidth
  const parsed = Number.parseInt(stored, 10)
  if (Number.isNaN(parsed)) return defaultWidth
  return clamp(parsed, minWidth, maxWidth)
}

export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  edge = "end",
  disabled = false,
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const widthRef = useRef(defaultWidth)

  useEffect(() => {
    const initial = readStoredWidth(
      storageKey,
      defaultWidth,
      minWidth,
      maxWidth,
    )
    widthRef.current = initial
    setWidth(initial)
  }, [storageKey, defaultWidth, minWidth, maxWidth])

  const startResize = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return
      event.preventDefault()
      event.stopPropagation()

      setIsResizing(true)
      const startX = event.clientX
      const startWidth = widthRef.current

      const onMove = (moveEvent: MouseEvent) => {
        const delta =
          edge === "end"
            ? moveEvent.clientX - startX
            : startX - moveEvent.clientX
        const next = clamp(startWidth + delta, minWidth, maxWidth)
        widthRef.current = next
        setWidth(next)
      }

      const onUp = () => {
        setIsResizing(false)
        window.localStorage.setItem(storageKey, String(widthRef.current))
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [disabled, edge, maxWidth, minWidth, storageKey],
  )

  return { width, isResizing, startResize }
}
