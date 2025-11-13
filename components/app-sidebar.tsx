"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Inbox, Mail, Archive, Settings, FileText, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { ProviderIcon } from "@/components/provider-icon"

const navigation = [
  { name: "Unified Inbox", href: "/inbox", icon: Inbox, count: 12 },
  { name: "Gmail", href: "/inbox?provider=gmail", icon: "gmail", count: 7 },
  { name: "Outlook", href: "/inbox?provider=outlook", icon: "outlook", count: 5 },
  { name: "Drafts", href: "/drafts", icon: FileText, count: 3 },
  { name: "Archives", href: "/archives", icon: Archive },
  { name: "AI Agent", href: "/agent", icon: Sparkles },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-16 flex-col items-center border-r border-border bg-sidebar py-6">
      {/* Logo */}
      <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
        <Mail className="h-5 w-5 text-primary-foreground" />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const IconComponent = typeof item.icon === "string" ? null : item.icon
          const isProviderIcon = typeof item.icon === "string"

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              title={item.name}
            >
              {isProviderIcon ? (
                <ProviderIcon provider={item.icon as "gmail" | "outlook"} className="h-5 w-5" />
              ) : (
                IconComponent && <IconComponent className="h-5 w-5" />
              )}
              {item.count && item.count > 0 && (
                <Badge
                  variant="default"
                  className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px] font-semibold"
                >
                  {item.count}
                </Badge>
              )}
              {isActive && <div className="absolute left-0 h-6 w-0.5 rounded-r-full bg-primary" />}
            </Link>
          )
        })}
      </nav>

      <div className="mb-2">
        <ThemeToggle />
      </div>

      {/* Settings at bottom */}
      <Link
        href="/settings"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
          pathname === "/settings"
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </Link>
    </aside>
  )
}
