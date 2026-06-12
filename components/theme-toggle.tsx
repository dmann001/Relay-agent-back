"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [title, setTitle] = useState("Toggle theme")

  // Only set title after component mounts to avoid hydration mismatch
  useEffect(() => {
    // Determine the effective theme (handle "system" theme)
    let effectiveTheme = theme
    if (theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    setTitle(`Switch to ${effectiveTheme === "light" ? "dark" : "light"} mode`)
  }, [theme])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        const effectiveTheme = document.documentElement.classList.contains("dark") ? "dark" : "light"
        setTheme(effectiveTheme === "light" ? "dark" : "light")
      }}
      className="relative h-9 w-9 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent"
      title={title}
    >
      <Sun className="h-6 w-6 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-6 w-6 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
