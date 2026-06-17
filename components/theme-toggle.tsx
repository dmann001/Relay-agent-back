"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  collapsed?: boolean
  className?: string
}

export function ThemeToggle({ collapsed = false, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
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

  return (
    <button
      type="button"
      onClick={() => {
        const effectiveTheme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light"
        setTheme(effectiveTheme === "light" ? "dark" : "light")
      }}
      className={cn(
        "flex h-10 w-full items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed ? "justify-center px-0" : "px-3",
        className,
      )}
      title={title}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </span>
      {!collapsed && <span className="ml-3">Appearance</span>}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
