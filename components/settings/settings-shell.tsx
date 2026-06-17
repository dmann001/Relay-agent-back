"use client"

import type { ReactNode } from "react"
import { SettingsNav } from "@/components/settings/settings-nav"

interface SettingsShellProps {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsShell({ title, description, children }: SettingsShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background lg:flex-row">
      <aside className="shrink-0 border-b border-border bg-surface-subtle/40 px-4 py-5 lg:w-64 lg:border-b-0 lg:border-r lg:py-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account and workspace.
          </p>
        </div>
        <SettingsNav />
      </aside>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <header className="mb-8">
            <h2 className="text-2xl font-light tracking-tight text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            )}
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}
