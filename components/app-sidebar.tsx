"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Inbox, Mail, Archive, Settings, FileText, LogOut, SendHorizontal, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { RelayedModeToggle } from "@/components/relayed-mode-toggle"
import { emailApi } from "@/lib/email-api"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

export function AppSidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [counts, setCounts] = useState({
    inbox: 0,
    drafts: 0,
    archives: 0,
    sent: 0,
    trash: 0,
  })

  const refreshCounts = async () => {
    try {
      const { counts: serverCounts } = await emailApi.getCounts()
      setCounts({
        inbox: serverCounts.inboxUnread,
        drafts: serverCounts.drafts,
        archives: serverCounts.archives,
        sent: serverCounts.sent,
        trash: serverCounts.trash,
      })
    } catch {
      // Not signed in yet, or backend unavailable - keep previous counts.
    }
  }

  useEffect(() => {
    void refreshCounts()
    const onRelayUpdate = () => void refreshCounts()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshCounts()
    }
    window.addEventListener("focus", onRelayUpdate)
    window.addEventListener("relay-emails-updated", onRelayUpdate)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onRelayUpdate)
      window.removeEventListener("relay-emails-updated", onRelayUpdate)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const navigation = [
    { name: "Inbox", href: "/inbox", icon: Inbox, count: counts.inbox },
    { name: "Sent", href: "/sent", icon: SendHorizontal, count: counts.sent },
    { name: "Drafts", href: "/drafts", icon: FileText, count: counts.drafts },
    { name: "Archives", href: "/archives", icon: Archive, count: counts.archives },
    { name: "Trash", href: "/trash", icon: Trash2, count: counts.trash },
  ]

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.04] bg-[#0A0A0B] py-6">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-3 px-6">
        <div className="relative">
          <div className="absolute inset-0 bg-[#E8DCC4] blur-lg opacity-40" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
            <Mail className="h-5 w-5 text-[#0A0A0B]" />
          </div>
        </div>
        <span className="text-lg font-semibold tracking-tight text-[#FAFAF9]">Relay</span>
      </div>

      {/* Mode Toggle */}
      <div className="mb-6 px-3">
        <RelayedModeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const IconComponent = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex h-10 items-center rounded-lg px-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-[#E8DCC4]/10 text-[#FAFAF9]"
                  : "text-[#8A8A8A] hover:bg-white/[0.03] hover:text-[#FAFAF9]",
              )}
              title={item.name}
            >
              <IconComponent className={cn("mr-3 h-4 w-4", isActive && "text-[#E8DCC4]")} />
              <span>{item.name}</span>
              {item.count && item.count > 0 && (
                <Badge
                  className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] bg-[#E8DCC4]/20 text-[#E8DCC4] border-0"
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
          <span className="text-xs font-medium text-[#5A5A5A]">Theme</span>
          <ThemeToggle />
        </div>

        {user?.email && (
          <div className="mb-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
            <div className="text-[11px] uppercase tracking-wide text-[#5A5A5A]">
              Signed in as
            </div>
            <div className="truncate text-sm text-[#FAFAF9]">{user.email}</div>
          </div>
        )}

        <Button
          className="mb-2 w-full justify-start bg-transparent text-[#8A8A8A] hover:bg-white/[0.03] hover:text-[#FAFAF9]"
          onClick={() => signOut()}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign out
        </Button>

        {/* Settings at bottom */}
        <Link
          href="/settings"
          className={cn(
            "flex h-10 items-center rounded-lg px-3 text-sm font-medium transition-all",
            pathname === "/settings"
              ? "bg-[#E8DCC4]/10 text-[#FAFAF9]"
              : "text-[#8A8A8A] hover:bg-white/[0.03] hover:text-[#FAFAF9]",
          )}
          title="Settings"
        >
          <Settings className={cn("mr-3 h-4 w-4", pathname === "/settings" && "text-[#E8DCC4]")} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  )
}
