"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { storage } from "@/lib/storage"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  Heart,
  Bell,
  X,
} from "lucide-react"

import type { Email } from "@/types"

interface AmbientIndicatorsProps {
  emails: Email[]
}

interface Indicator {
  id: string
  type: 'relationship' | 'volume' | 'sentiment' | 'stale' | 'vip'
  icon: typeof Users
  title: string
  description: string
  color: string
  bgColor: string
  priority: number
}

export function AmbientIndicators({ emails }: AmbientIndicatorsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const vipSenders = storage.getVipSenders()

  const indicators = useMemo(() => {
    const results: Indicator[] = []

    // Check for relationships needing attention (no reply in 7+ days)
    const staleConversations = emails.filter(email => {
      if (!email.lastInteraction && !email.read) return false
      const daysSinceInteraction = email.lastInteraction
        ? Math.floor((Date.now() - new Date(email.lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
        : 999
      const isFromVip = vipSenders.includes(email.from.email.toLowerCase())
      return daysSinceInteraction >= 7 && isFromVip
    })

    if (staleConversations.length > 0) {
      results.push({
        id: 'stale_vip',
        type: 'relationship',
        icon: Heart,
        title: 'VIP Follow-up Needed',
        description: `${staleConversations.length} VIP contact${staleConversations.length > 1 ? 's' : ''} waiting for your response`,
        color: 'text-pink-400',
        bgColor: 'bg-pink-500/10',
        priority: 90,
      })
    }

    // Check for sudden email volume from one sender
    const senderCounts = emails.reduce((acc, email) => {
      const sender = email.from.email.toLowerCase()
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000
      if (new Date(email.date).getTime() > dayAgo) {
        acc[sender] = (acc[sender] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const highVolumeSenders = Object.entries(senderCounts)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])

    if (highVolumeSenders.length > 0) {
      const [topSender, count] = highVolumeSenders[0]
      const senderName = emails.find(e => e.from.email.toLowerCase() === topSender)?.from.name || topSender
      results.push({
        id: `volume_${topSender}`,
        type: 'volume',
        icon: TrendingUp,
        title: 'Unusual Activity',
        description: `${count} emails from ${senderName} in the last 24h`,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        priority: 70,
      })
    }

    // Check for sentiment shifts (negative emails)
    const negativeEmails = emails.filter(email =>
      email.sentiment?.sentiment === 'negative' &&
      new Date(email.date).getTime() > Date.now() - 24 * 60 * 60 * 1000
    )

    if (negativeEmails.length >= 2) {
      results.push({
        id: 'negative_sentiment',
        type: 'sentiment',
        icon: AlertTriangle,
        title: 'Sentiment Alert',
        description: `${negativeEmails.length} emails with negative tone detected`,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        priority: 80,
      })
    }

    // Check for VIP unread emails
    const unreadVipEmails = emails.filter(email =>
      !email.read && vipSenders.includes(email.from.email.toLowerCase())
    )

    if (unreadVipEmails.length > 0) {
      results.push({
        id: 'unread_vip',
        type: 'vip',
        icon: Users,
        title: 'VIP Messages',
        description: `${unreadVipEmails.length} unread email${unreadVipEmails.length > 1 ? 's' : ''} from important contacts`,
        color: 'text-[#E8DCC4]',
        bgColor: 'bg-[#E8DCC4]/10',
        priority: 85,
      })
    }

    // Check for pending responses (emails flagged as requiring response)
    const pendingResponses = emails.filter(email => email.requiresResponse && !email.read)
    if (pendingResponses.length > 0) {
      results.push({
        id: 'pending_responses',
        type: 'stale',
        icon: Clock,
        title: 'Responses Needed',
        description: `${pendingResponses.length} email${pendingResponses.length > 1 ? 's' : ''} awaiting your reply`,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        priority: 75,
      })
    }

    // Sort by priority
    return results.sort((a, b) => b.priority - a.priority)
  }, [emails, vipSenders])

  // Filter out dismissed indicators
  const visibleIndicators = indicators.filter(ind => !dismissedIds.has(ind.id))

  const dismissIndicator = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]))
  }

  if (visibleIndicators.length === 0) return null

  return (
    <div className="border-b border-white/[0.04] bg-white/[0.02] px-6 py-3">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
        <Bell className="h-4 w-4 shrink-0 text-[#8A8A8A]" />
        {visibleIndicators.slice(0, 4).map((indicator) => {
          const Icon = indicator.icon
          return (
            <div
              key={indicator.id}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 transition-all",
                indicator.bgColor,
                "hover:ring-2 hover:ring-white/[0.08]"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", indicator.color)} />
              <div className="flex flex-col">
                <span className={cn("text-xs font-medium", indicator.color)}>{indicator.title}</span>
                <span className="text-[10px] text-[#8A8A8A]">{indicator.description}</span>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  dismissIndicator(indicator.id)
                }}
                className={cn(
                  "ml-1 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                  "hover:bg-white/[0.06]"
                )}
              >
                <X className="h-3 w-3 text-[#8A8A8A]" />
              </button>
            </div>
          )
        })}
        {visibleIndicators.length > 4 && (
          <Badge className="shrink-0 bg-white/[0.03] border border-white/[0.08] text-[#8A8A8A]">
            +{visibleIndicators.length - 4} more
          </Badge>
        )}
      </div>
    </div>
  )
}
