"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckSquare, FileText, Inbox, PenSquare, SendHorizontal, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { ComposeDialog } from "@/components/compose-dialog"

export function MobileBottomNav() {
  const pathname = usePathname()
  const [composeOpen, setComposeOpen] = useState(false)
  const links = [
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/sent", label: "Sent", icon: SendHorizontal },
    { href: "/drafts", label: "Drafts", icon: FileText },
    { href: "/commitments", label: "Tasks", icon: CheckSquare },
    { href: "/settings", label: "Settings", icon: Settings },
  ]
  return <>
    <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/95 px-2 backdrop-blur lg:hidden" aria-label="Mobile navigation">
      {links.slice(0, 2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-w-14 flex-col items-center gap-1 text-[10px]", pathname === href ? "text-brand" : "text-muted-foreground")}><Icon className="h-5 w-5" />{label}</Link>)}
      <button type="button" onClick={() => setComposeOpen(true)} className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg" aria-label="Compose email"><PenSquare className="h-5 w-5" /></button>
      {links.slice(2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-w-14 flex-col items-center gap-1 text-[10px]", pathname === href ? "text-brand" : "text-muted-foreground")}><Icon className="h-5 w-5" />{label}</Link>)}
    </nav>
  </>
}
