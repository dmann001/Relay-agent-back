"use client"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Clock, FileText, PenSquare, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/provider-icon"
import { ComposeDialog } from "@/components/compose-dialog"
import { emailApi, type RemoteDraft } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"

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
  const [drafts, setDrafts] = useState<RemoteDraft[]>([])
  const [activeDraft, setActiveDraft] = useState<RemoteDraft | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const { toast } = useToast()

  const sortedDrafts = useMemo(() => {
    return [...drafts].sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime())
  }, [drafts])

  const loadDrafts = async () => {
    try {
      setDrafts(await emailApi.listDrafts())
    } catch (error) {
      console.error("[Drafts] Failed to load:", error)
    }
  }

  useEffect(() => {
    const init = async () => {
      await loadDrafts()
      setIsLoading(false)
      // Pull the latest drafts from Gmail in the background.
      try {
        setIsSyncing(true)
        await emailApi.sync("drafts")
        await loadDrafts()
      } catch (error) {
        console.error("[Drafts] Sync failed:", error)
      } finally {
        setIsSyncing(false)
      }
    }
    void init()

    const onUpdate = () => void loadDrafts()
    window.addEventListener("relay-emails-updated", onUpdate)
    return () => window.removeEventListener("relay-emails-updated", onUpdate)
  }, [])

  const handleEditDraft = (draft: RemoteDraft) => {
    setActiveDraft(draft)
    setComposeOpen(true)
  }

  const handleDeleteDraft = async (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId))
    try {
      await emailApi.deleteDraft(draftId)
      toast({ title: "Draft deleted", description: "Removed from Gmail Drafts too" })
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete draft",
        variant: "destructive",
      })
      await loadDrafts()
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-6 py-5">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground">Drafts</h1>
          <p className="text-sm text-muted-foreground">Autosaved to Gmail Drafts</p>
        </div>
        {isSyncing && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Syncing from Gmail...
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : sortedDrafts.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-raised">
            <FileText className="h-8 w-8 text-brand" />
          </div>
          <h3 className="text-xl font-light text-foreground">No drafts saved</h3>
          <p className="mt-2 text-sm text-muted-foreground">Drafts you save will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sortedDrafts.map((draft) => (
            <div key={draft.id} className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-surface-hover">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    To: {draft.to.join(", ") || "(No Recipients)"}
                  </span>
                  <Badge variant="outline" className="h-5 border-border bg-surface-raised px-1.5">
                    <ProviderIcon className="h-3 w-3" />
                  </Badge>
                  <Badge className="h-5 px-2 text-[10px] bg-[#FEBC2E]/10 text-[#FEBC2E] border-0">
                    <Clock className="mr-1 h-3 w-3" />
                    {draft.status === "failed" ? "Save failed" : "Draft"}
                  </Badge>
                </div>
                <div className="mb-1 text-sm font-medium text-foreground">{draft.subject || "(No Subject)"}</div>
                <p className="line-clamp-1 text-sm text-muted-foreground">{draft.snippet || draft.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatTimestamp(draft.lastEdited)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  onClick={() => handleEditDraft(draft)}
                  title="Edit draft"
                >
                  <PenSquare className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#8A8A8A] hover:text-red-400 hover:bg-red-500/10"
                  onClick={() => void handleDeleteDraft(draft.id)}
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
          if (!isOpen) {
            setActiveDraft(null)
            void loadDrafts()
          }
        }}
        draft={activeDraft || undefined}
      />
    </div>
  )
}
