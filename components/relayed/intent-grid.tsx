"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  ChevronRight,
  CheckCircle2,
  X,
} from "lucide-react"

import type { Email, EmailIntent } from "@/types"

interface IntentConfig {
  label: string
  icon: typeof CheckCircle2
  color: string
  bgColor: string
}

interface IntentGridProps {
  emails: Email[]
  intentConfig: Record<EmailIntent, IntentConfig>
}

function formatTimestamp(date: string): string {
  const emailDate = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - emailDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return emailDate.toLocaleDateString()
}

export function IntentGrid({ emails, intentConfig }: IntentGridProps) {
  const [expandedIntent, setExpandedIntent] = useState<EmailIntent | null>(null)

  // Group emails by intent
  const emailsByIntent = emails.reduce((acc, email) => {
    const intent = email.intent || 'unknown'
    if (!acc[intent]) acc[intent] = []
    acc[intent].push(email)
    return acc
  }, {} as Record<EmailIntent, Email[]>)

  // Order intents by importance
  const intentOrder: EmailIntent[] = ['decision', 'action_item', 'meeting', 'info_request', 'relationship', 'update', 'unknown']

  if (expandedIntent) {
    const config = intentConfig[expandedIntent]
    const intentEmails = emailsByIntent[expandedIntent] || []
    const IntentIcon = config.icon

    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-border/70 bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border border-border/60", config.bgColor)}>
                <IntentIcon className={cn("h-5 w-5", config.color)} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{config.label}</h2>
                <p className="text-sm text-muted-foreground">{intentEmails.length} emails</p>
              </div>
            </div>
            <button
              onClick={() => setExpandedIntent(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:text-amber-700 hover:border-amber-500/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Email List */}
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border/50">
            {intentEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <IntentIcon className={cn("h-12 w-12 mb-4", config.color, "opacity-50")} />
                <p className="text-muted-foreground">No emails in this category</p>
              </div>
            ) : (
              intentEmails.map((email) => (
                <Link
                  key={email.id}
                  href={`/thread/${email.id}`}
                  className={cn(
                    "flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/30",
                    !email.read && "bg-muted/40"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={cn("border border-border/70", config.bgColor)}>
                      {email.from.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={cn("text-sm text-foreground", !email.read && "font-semibold")}>
                        {email.from.name}
                      </span>
                      {email.priorityScore && email.priorityScore >= 70 && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                          Priority
                        </Badge>
                      )}
                    </div>
                    <p className={cn("text-sm truncate", !email.read ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {email.subject}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {(email.bodyPlain || email.body || "").replace(/<[^>]*>/g, "").slice(0, 100)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTimestamp(email.date)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
        {intentOrder.map((intent) => {
          const config = intentConfig[intent]
          const intentEmails = emailsByIntent[intent] || []
          const IntentIcon = config.icon

          return (
            <div
              key={intent}
              className={cn(
                "group cursor-pointer rounded-2xl border border-border/70 bg-card/70 p-4 transition-all duration-300",
                "hover:border-amber-500/40 hover:-translate-y-1",
                intentEmails.length === 0 && "opacity-60"
              )}
              onClick={() => intentEmails.length > 0 && setExpandedIntent(intent)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border border-border/60", config.bgColor)}>
                    <IntentIcon className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{config.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {intentEmails.length} {intentEmails.length === 1 ? "email" : "emails"}
                    </p>
                  </div>
                </div>
                {intentEmails.length > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                )}
              </div>
              <div className="mt-4">
                {intentEmails.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No emails in this lane</p>
                ) : (
                  <div className="space-y-2">
                    {intentEmails.slice(0, 3).map((email) => (
                      <div key={email.id} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {email.from.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">{email.from.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{email.subject}</p>
                        </div>
                      </div>
                    ))}
                    {intentEmails.length > 3 && (
                      <p className="text-center text-xs text-muted-foreground">+{intentEmails.length - 3} more</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

