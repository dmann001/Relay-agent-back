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
      <Card className="m-4 border-primary bg-primary/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold">AI Proposes: {proposedAction.type}</div>
              <div className="text-sm text-muted-foreground">{proposedAction.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowPreview(true)}>Preview & Confirm</Button>
            <Button variant="outline" onClick={() => setIsVisible(false)}>
              Dismiss
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsVisible(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview AI Action</DialogTitle>
            <DialogDescription>Review the proposed action before executing. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold">Action Type</div>
              <div className="rounded-lg border border-border bg-muted p-3 text-sm">{proposedAction.type}</div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Draft Reply</div>
              <div className="rounded-lg border border-border bg-muted p-3 text-sm whitespace-pre-wrap">
                {proposedAction.draftContent}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowPreview(false)
                setIsVisible(false)
                // Execute action here
              }}
            >
              Confirm & Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
