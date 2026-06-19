"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  collapsed?: boolean
  className?: string
}

function useThemeToggleLabel() {
  const { theme } = useTheme()
  const [title, setTitle] = useState("Toggle theme")

  useEffect(() => {
    let effectiveTheme = theme
    if (theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    }
    setTitle(`Switch to ${effectiveTheme === "light" ? "dark" : "light"} mode`)
  }, [theme])

  return title
}

function toggleTheme(setTheme: (theme: "dark" | "light") => void) {
  const effectiveTheme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light"
  setTheme(effectiveTheme === "light" ? "dark" : "light")
}

export function ThemeToggle({ collapsed = false, className }: ThemeToggleProps) {
  const { setTheme } = useTheme()
  const title = useThemeToggleLabel()

  return (
    <button
      type="button"
      onClick={() => toggleTheme(setTheme)}
      className={cn(
        "flex h-10 w-full items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed ? "justify-center px-0" : "px-3",
        className,
      )}
      title={title}
    >
      <ThemeToggleGlyph />
      {!collapsed && <span className="ml-3">Appearance</span>}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}

function ThemeToggleGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-4 w-4 shrink-0 items-center justify-center", className)}>
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </span>
  )
}

interface ThemeToggleIconProps {
  className?: string
  /** Light styling for the floating dark-image nav pill */
  inverted?: boolean
}

export function ThemeToggleIcon({ className, inverted = false }: ThemeToggleIconProps) {
  const { setTheme } = useTheme()
  const title = useThemeToggleLabel()

  return (
    <button
      type="button"
      onClick={() => toggleTheme(setTheme)}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
        inverted
          ? "text-white/90 hover:bg-white/10 hover:text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white",
        className,
      )}
      title={title}
      aria-label={title}
    >
      <ThemeToggleGlyph className="h-4 w-4" />
    </button>
  )
}
