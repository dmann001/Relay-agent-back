"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { storage } from "@/lib/storage"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  TrendingUp,
  AlertTriangle,
  Star,
  Clock,
  Flame,
  Smile,
  Frown,
  Meh,
  Calendar,
  ChevronRight,
  Filter,
} from "lucide-react"

import type { Email } from "@/types"

interface PriorityFeedProps {
  emails: Email[]
}

type FilterType = 'all' | 'urgent' | 'vip' | 'unread' | 'meetings'

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

function getPriorityLabel(score: number): { label: string; color: string; icon: typeof Flame } {
  if (score >= 90) return { label: 'Critical', color: 'text-red-500 bg-red-500/10', icon: Flame }
  if (score >= 70) return { label: 'High', color: 'text-orange-500 bg-orange-500/10', icon: AlertTriangle }
  if (score >= 50) return { label: 'Medium', color: 'text-yellow-500 bg-yellow-500/10', icon: TrendingUp }
  return { label: 'Low', color: 'text-muted-foreground bg-muted', icon: Clock }
}

function calculatePriority(email: Email, vipSenders: string[]): number {
  let score = email.priorityScore || 50

  if (vipSenders.includes(email.from.email.toLowerCase())) score += 20
  if (email.sentiment?.urgency === 'critical') score += 30
  else if (email.sentiment?.urgency === 'high') score += 20
  else if (email.sentiment?.urgency === 'medium') score += 10
  if (!email.read) score += 10
  if (email.meetingRequest?.detected) score += 15

  const hoursOld = (Date.now() - new Date(email.date).getTime()) / (1000 * 60 * 60)
  if (hoursOld < 1) score += 15
  else if (hoursOld < 24) score += 10

  return Math.min(100, score)
}

export function PriorityFeed({ emails }: PriorityFeedProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const vipSenders = storage.getVipSenders()

  // Sort and filter emails
  const sortedEmails = useMemo(() => {
    let filtered = [...emails]

    // Apply filter
    switch (activeFilter) {
      case 'urgent':
        filtered = filtered.filter(e => 
          (e.priorityScore || 0) >= 70 || 
          e.sentiment?.urgency === 'high' || 
          e.sentiment?.urgency === 'critical'
        )
        break
      case 'vip':
        filtered = filtered.filter(e => vipSenders.includes(e.from.email.toLowerCase()))
        break
      case 'unread':
        filtered = filtered.filter(e => !e.read)
        break
      case 'meetings':
        filtered = filtered.filter(e => e.meetingRequest?.detected)
        break
    }

    // Sort by calculated priority
    return filtered
      .map(email => ({ ...email, calculatedPriority: calculatePriority(email, vipSenders) }))
      .sort((a, b) => b.calculatedPriority - a.calculatedPriority)
  }, [emails, activeFilter, vipSenders])

  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: emails.length },
    { id: 'urgent', label: 'Urgent', count: emails.filter(e => (e.priorityScore || 0) >= 70 || e.sentiment?.urgency === 'high' || e.sentiment?.urgency === 'critical').length },
    { id: 'vip', label: 'VIP', count: emails.filter(e => vipSenders.includes(e.from.email.toLowerCase())).length },
    { id: 'unread', label: 'Unread', count: emails.filter(e => !e.read).length },
    { id: 'meetings', label: 'Meetings', count: emails.filter(e => e.meetingRequest?.detected).length },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Filter Bar */}
      <div className="border-b border-border/70 px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition-colors",
                  activeFilter === filter.id
                    ? "border-amber-500/40 text-amber-700 bg-amber-500/10"
                    : "border-border/70 text-muted-foreground hover:text-amber-700 hover:border-amber-500/40"
                )}
              >
                {filter.label}
                <span className="ml-2 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Email List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-6">
          {sortedEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <TrendingUp className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No emails match this filter</p>
            </div>
          ) : (
            sortedEmails.map((email) => {
              const priority = getPriorityLabel(email.calculatedPriority)
              const PriorityIcon = priority.icon
              const isVip = vipSenders.includes(email.from.email.toLowerCase())

              return (
                <Link key={email.id} href={`/thread/${email.id}`}>
                  <Card className={cn(
                    "group transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
                    "border border-border/70 bg-card/70",
                    !email.read && "border-l-4 border-l-amber-500",
                    email.calculatedPriority >= 90 && "border-l-red-500"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Priority Indicator */}
                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                          priority.color
                        )}>
                          <PriorityIcon className="h-5 w-5" />
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background">
                          <AvatarFallback className={cn(isVip && "bg-amber-500/20 text-amber-600")}>
                            {email.from.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2 flex-wrap">
                            <span className={cn("text-sm", !email.read && "font-semibold")}>
                              {email.from.name}
                            </span>
                            {isVip && (
                              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            )}
                            {email.meetingRequest?.detected && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-purple-300">
                                <Calendar className="h-3 w-3" />
                                Meeting
                              </span>
                            )}
                            {/* Sentiment */}
                            {email.sentiment && (
                              <span className="flex items-center">
                                {email.sentiment.sentiment === 'positive' && <Smile className="h-3.5 w-3.5 text-green-500" />}
                                {email.sentiment.sentiment === 'negative' && <Frown className="h-3.5 w-3.5 text-red-500" />}
                                {email.sentiment.sentiment === 'neutral' && <Meh className="h-3.5 w-3.5 text-gray-400" />}
                              </span>
                            )}
                          </div>
                          <p className={cn("text-sm truncate", !email.read ? "font-medium text-foreground" : "text-muted-foreground")}>
                            {email.subject}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                            {(email.bodyPlain || email.body || '').replace(/<[^>]*>/g, '').slice(0, 120)}
                          </p>

                          {/* Priority & Time */}
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest", priority.color)}>
                              Priority {email.calculatedPriority}
                            </span>
                            <span className="text-muted-foreground">{formatTimestamp(email.date)}</span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
