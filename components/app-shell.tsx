import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen min-h-0 bg-background text-foreground">
      <div className="hidden h-full shrink-0 lg:flex">
        <AppSidebar />
      </div>
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden pb-16 lg:pb-0">
        {children}
      </div>
      <MobileBottomNav />
    </div>
  )
}
