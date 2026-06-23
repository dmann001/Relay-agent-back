"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, BrainCircuit, Plug, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

const groups = [
  {
    label: "Personal",
    items: [
      {
        href: "/settings/profile",
        label: "Profile",
        icon: UserRound,
      },
    ],
  },
  {
    label: "Mail",
    items: [
      {
        href: "/settings/connections",
        label: "Connected accounts",
        icon: Plug,
      },
    ],
  },
  {
    label: "AI & Agents",
    items: [
      {
        href: "/settings/ai",
        label: "Agent personalization",
        icon: Bot,
      },
      {
        href: "/settings/ai-models",
        label: "Models & tools",
        icon: BrainCircuit,
      },
    ],
  },
] as const

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-5" aria-label="Settings sections">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-1 px-3 text-sm font-semibold text-muted-foreground">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                pathname.startsWith(`${href}/`) ||
                (href === "/settings/profile" && pathname === "/settings")

              return (
                <Link
                  key={`${group.label}-${label}`}
                  href={href}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-foreground")} />
                  <span className="min-w-0 truncate">{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
