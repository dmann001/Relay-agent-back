"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, Search } from "lucide-react"
import { SettingsNav } from "@/components/settings/settings-nav"

interface SettingsShellProps {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsShell({ title, description, children }: SettingsShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background lg:flex-row">
      <aside className="shrink-0 border-b border-border bg-sidebar px-3 py-4 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="mb-4 space-y-4">
          <Link
            href="/inbox"
            className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Link>
          <label className="flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground">
            <Search className="mr-2 h-4 w-4" />
            <span className="sr-only">Search settings</span>
            <input
              type="search"
              placeholder="Search..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <SettingsNav />
      </aside>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 lg:py-20">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
            )}
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}
