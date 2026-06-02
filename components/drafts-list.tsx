"use client"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, FileText, PenSquare, Trash2 } from "lucide-react"
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
    <div className="flex-1 overflow-auto bg-[#0A0A0B]">
      <div className="border-b border-white/[0.04] px-6 py-5" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
        <h1 className="text-2xl font-light tracking-tight text-[#FAFAF9]">Drafts</h1>
        <p className="text-sm text-[#8A8A8A]">Unfinished emails saved for later</p>
      </div>
      {sortedDrafts.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
            <FileText className="h-8 w-8 text-[#E8DCC4]" />
          </div>
          <h3 className="text-xl font-light text-[#FAFAF9]">No drafts saved</h3>
          <p className="mt-2 text-sm text-[#8A8A8A]">Drafts you save will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {sortedDrafts.map((draft) => (
            <div key={draft.id} className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02]">
              <Checkbox className="mt-1 border-white/[0.15] data-[state=checked]:bg-[#E8DCC4] data-[state=checked]:text-[#0A0A0B]" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-[#FAFAF9]">
                    To: {draft.to.join(", ") || "(No Recipients)"}
                  </span>
                  <Badge variant="outline" className="h-5 px-1.5 border-white/[0.08] bg-transparent">
                    <ProviderIcon className="h-3 w-3" />
                  </Badge>
                  <Badge className="h-5 px-2 text-[10px] bg-[#FEBC2E]/10 text-[#FEBC2E] border-0">
                    <Clock className="mr-1 h-3 w-3" />
                    Draft
                  </Badge>
                </div>
                <div className="mb-1 text-sm font-medium text-[#FAFAF9]">{draft.subject}</div>
                <p className="line-clamp-1 text-sm text-[#8A8A8A]">{draft.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-[#5A5A5A]">{formatTimestamp(draft.lastEdited)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
                  onClick={() => handleEditDraft(draft)}
                  title="Edit draft"
                >
                  <PenSquare className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#8A8A8A] hover:text-red-400 hover:bg-red-500/10"
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
