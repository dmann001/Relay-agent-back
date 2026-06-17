"use client"

import { cn } from "@/lib/utils"

interface ResizeHandleProps {
  onMouseDown: (event: React.MouseEvent) => void
  isResizing?: boolean
  className?: string
  label?: string
}

export function ResizeHandle({
  onMouseDown,
  isResizing = false,
  className,
  label = "Resize panel",
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onMouseDown={onMouseDown}
      className={cn(
        "group relative z-20 w-px shrink-0 cursor-col-resize touch-none bg-border",
        "after:absolute after:inset-y-0 after:-left-1.5 after:-right-1.5 after:content-['']",
        isResizing ? "bg-foreground/40" : "hover:bg-foreground/25",
        className,
      )}
    />
  )
}
