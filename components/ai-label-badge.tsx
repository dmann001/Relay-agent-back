"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const labelColors = {
  urgent: "bg-red-500/10 text-red-500 border-red-500/20",
  important: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  action: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  followup: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  meeting: "bg-green-500/10 text-green-500 border-green-500/20",
  financial: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  personal: "bg-pink-500/10 text-pink-500 border-pink-500/20",
}

type LabelType = keyof typeof labelColors

interface AiLabelBadgeProps {
  label: LabelType
  className?: string
}

export function AiLabelBadge({ label, className }: AiLabelBadgeProps) {
  return (
    <Badge variant="outline" className={cn("h-5 px-2 text-[10px] font-medium", labelColors[label], className)}>
      {label}
    </Badge>
  )
}
