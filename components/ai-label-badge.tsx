"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const labelColors = {
  urgent: "bg-red-500/10 text-red-400 border-red-500/20",
  important: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  action: "bg-[#E8DCC4]/10 text-[#E8DCC4] border-[#E8DCC4]/20",
  followup: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  meeting: "bg-green-500/10 text-green-400 border-green-500/20",
  financial: "bg-[#FEBC2E]/10 text-[#FEBC2E] border-[#FEBC2E]/20",
  personal: "bg-pink-500/10 text-pink-400 border-pink-500/20",
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
