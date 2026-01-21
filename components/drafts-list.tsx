"use client"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, PenSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/provider-icon"
import { ComposeDialog } from "@/components/compose-dialog"
import { storage } from "@/lib/storage"
import type { Draft } from "@/types"

function formatTimestamp(date: string): string {
  const draftDate = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - draftDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return draftDate.toLocaleDateString()
}

export function DraftsList() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)

  const sortedDrafts = useMemo(() => {
    return [...drafts].sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime())
  }, [drafts])

  useEffect(() => {
    const refreshDrafts = () => setDrafts(storage.getDrafts())
    refreshDrafts()
    window.addEventListener("relay-storage-updated", refreshDrafts)
    return () => window.removeEventListener("relay-storage-updated", refreshDrafts)
  }, [])

  const handleEditDraft = (draft: Draft) => {
    setActiveDraft(draft)
    setComposeOpen(true)
  }

  const handleDeleteDraft = (draftId: string) => {
    storage.removeDraft(draftId)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-semibold">Drafts</h1>
        <p className="text-sm text-muted-foreground">Unfinished emails saved for later</p>
      </div>
      {sortedDrafts.length === 0 ? (
        <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
          No drafts saved yet.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sortedDrafts.map((draft) => (
            <div key={draft.id} className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/50">
              <Checkbox className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium">
                    To: {draft.to.join(", ") || "(No Recipients)"}
                  </span>
                  <Badge variant="outline" className="h-5 px-1.5">
                    <ProviderIcon provider={draft.provider} className="h-3 w-3" />
                  </Badge>
                  <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                    <Clock className="mr-1 h-3 w-3" />
                    Draft
                  </Badge>
                </div>
                <div className="mb-1 text-sm font-medium">{draft.subject}</div>
                <p className="line-clamp-1 text-sm text-muted-foreground">{draft.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatTimestamp(draft.lastEdited)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEditDraft(draft)}
                  title="Edit draft"
                >
                  <PenSquare className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDeleteDraft(draft.id)}
                  title="Delete draft"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ComposeDialog
        open={composeOpen}
        onOpenChange={(isOpen) => {
          setComposeOpen(isOpen)
          if (!isOpen) setActiveDraft(null)
        }}
        draft={activeDraft || undefined}
      />
    </div>
  )
}
