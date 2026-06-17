"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, Plug, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  {
    href: "/settings/profile",
    label: "Profile",
    description: "Account and identity",
    icon: UserRound,
  },
  {
    href: "/settings/connections",
    label: "Connections",
    description: "Email accounts and calendar",
    icon: Plug,
  },
  {
    href: "/settings/ai",
    label: "AI personalization",
    description: "Writing style and drafts",
    icon: Bot,
  },
] as const

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1" aria-label="Settings sections">
      {items.map(({ href, label, description, icon: Icon }) => {
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (href === "/settings/profile" && pathname === "/settings")

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active && "text-foreground")} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{description}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
