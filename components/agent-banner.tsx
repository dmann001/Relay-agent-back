"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sparkles, X } from "lucide-react"

export function AgentBanner() {
  const [isVisible, setIsVisible] = useState(true)
  const [showPreview, setShowPreview] = useState(false)

  if (!isVisible) return null

  const proposedAction = {
    type: "Reply and Archive",
    description: "Send a thank you reply and archive this thread",
    draftContent: `Hi Sarah,

Thank you for sharing the Q4 roadmap! Everything looks great and the timeline is clear.

I'd love to schedule a quick 15-minute call to discuss the mobile app beta testing phase in more detail.

Best regards`,
  }

  return (
    <>
      <Card className="m-4 border border-[#E8DCC4]/20 bg-[#E8DCC4]/[0.03] p-4 rounded-2xl" style={{ backdropFilter: 'blur(40px)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
              <Sparkles className="h-4 w-4 text-[#0A0A0B]" />
            </div>
            <div>
              <div className="font-medium text-[#FAFAF9]">AI Proposes: {proposedAction.type}</div>
              <div className="text-sm text-[#8A8A8A]">{proposedAction.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowPreview(true)}
              className="bg-gradient-to-b from-[#E8DCC4] to-[#C4A052] hover:from-[#F5EDD8] hover:to-[#D4B062] text-[#0A0A0B] font-medium rounded-xl"
            >
              Preview & Confirm
            </Button>
            <Button
              onClick={() => setIsVisible(false)}
              className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-xl"
            >
              Dismiss
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsVisible(false)}
              className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl border border-white/[0.06] bg-[#0A0A0B] text-[#FAFAF9] rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.98) 0%, rgba(10,10,11,1) 100%)', backdropFilter: 'blur(40px)' }}>
          <DialogHeader>
            <DialogTitle className="text-[#FAFAF9]">Preview AI Action</DialogTitle>
            <DialogDescription className="text-[#8A8A8A]">Review the proposed action before executing. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-[#FAFAF9]">Action Type</div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-[#FAFAF9]">{proposedAction.type}</div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-[#FAFAF9]">Draft Reply</div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-[#FAFAF9] whitespace-pre-wrap">
                {proposedAction.draftContent}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowPreview(false)}
              className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowPreview(false)
                setIsVisible(false)
                // Execute action here
              }}
              className="bg-gradient-to-b from-[#E8DCC4] to-[#C4A052] hover:from-[#F5EDD8] hover:to-[#D4B062] text-[#0A0A0B] font-medium rounded-xl"
            >
              Confirm & Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
