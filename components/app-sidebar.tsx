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
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar py-6">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Mail className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">Relay</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const IconComponent = typeof item.icon === "string" ? null : item.icon
          const isProviderIcon = typeof item.icon === "string"

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              title={item.name}
            >
              {isProviderIcon ? (
                <ProviderIcon provider={item.icon as "gmail" | "outlook"} className="mr-3 h-4 w-4" />
              ) : (
                IconComponent && <IconComponent className="mr-3 h-4 w-4" />
              )}
              <span>{item.name}</span>
              {item.count && item.count > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]"
                >
                  {item.count}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto px-3">
        <div className="mb-2 flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>

        {/* Settings at bottom */}
        <Link
          href="/settings"
          className={cn(
            "flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
          title="Settings"
        >
          <Settings className="mr-3 h-4 w-4" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  )
}
