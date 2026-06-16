"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { emailApi, type Commitment, type CommitmentType } from "@/lib/email-api"

export interface CommitmentCandidate {
  title: string
  owner: string
  dueDate: string
  evidence: string
}

function inferredLocalDate(value: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TrackCommitmentDialog({
  candidate,
  accountId,
  providerMessageId,
  open,
  onOpenChange,
  onTracked,
}: {
  candidate: CommitmentCandidate | null
  accountId?: string
  providerMessageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onTracked: (commitment: Commitment) => void
}) {
  const [type, setType] = useState<CommitmentType>("my_task")
  const [title, setTitle] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [evidence, setEvidence] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!candidate || !open) return
    setTitle(candidate.title)
    setOwnerName(candidate.owner)
    setDueAt(inferredLocalDate(candidate.dueDate))
    setEvidence(candidate.evidence)
    setType(candidate.owner && !/\b(you|user|me)\b/i.test(candidate.owner) ? "waiting_for_reply" : "my_task")
    setError(null)
  }, [candidate, open])

  const submit = async () => {
    if (!candidate || !accountId || !title.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const commitment = await emailApi.createCommitment({
        accountId,
        providerMessageId,
        type,
        title: title.trim(),
        expectedOutcome: title.trim(),
        ownerName: ownerName.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        evidence: evidence.trim(),
      })
      onTracked(commitment)
      onOpenChange(false)
    } catch (caught: any) {
      setError(caught.message || "Could not track this commitment.")
    } finally {
      setIsSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Track commitment</DialogTitle>
        <DialogDescription>Review Relay&apos;s interpretation before it becomes a persistent item.</DialogDescription>
      </DialogHeader>
      {!accountId && <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">The source account could not be identified.</div>}
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="commitment-title">Title</Label><Input id="commitment-title" value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} /></div>
        <div className="space-y-2">
          <Label htmlFor="commitment-type">Type</Label>
          <select id="commitment-type" value={type} onChange={(event) => setType(event.target.value as CommitmentType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="my_task">My task</option>
            <option value="waiting_for_reply">Waiting for reply</option>
            <option value="waiting_for_artifact">Waiting for document or artifact</option>
            <option value="follow_up">Follow up</option>
          </select>
        </div>
        <div className="space-y-2"><Label htmlFor="commitment-owner">Owner</Label><Input id="commitment-owner" value={ownerName} maxLength={200} onChange={(event) => setOwnerName(event.target.value)} placeholder="You or the person responsible" /></div>
        <div className="space-y-2"><Label htmlFor="commitment-due">Due date</Label><Input id="commitment-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><p className="text-xs text-muted-foreground">Leave blank if the email does not state a reliable date.</p></div>
        <div className="space-y-2"><Label htmlFor="commitment-evidence">Evidence</Label><Textarea id="commitment-evidence" value={evidence} maxLength={4000} onChange={(event) => setEvidence(event.target.value)} className="min-h-24" /></div>
        {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button onClick={() => void submit()} disabled={isSaving || !accountId || !title.trim()}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Track</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

