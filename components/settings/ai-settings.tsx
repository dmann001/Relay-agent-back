"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Check, Loader2, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { emailApi, type AiAccountPreference, type MemoryItem, type MemoryProfile } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"
import { SettingsShell } from "@/components/settings/settings-shell"
import Link from "next/link"

export function AiSettings() {
  const [aiPreferences, setAiPreferences] = useState<AiAccountPreference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const loadPreferences = useCallback(async () => {
    try {
      setAiPreferences(await emailApi.listAiPreferences())
    } catch (error) {
      console.error("[Settings] Failed to load AI preferences:", error)
      toast({
        title: "Could not load AI settings",
        description: "Refresh the page and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  return (
    <SettingsShell
      title="AI personalization"
      description="Tune how Relay summarizes mail and drafts replies for each account."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading AI settings...
        </div>
      ) : aiPreferences.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-border bg-card">
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft">
              <Bot className="h-7 w-7 text-brand-strong" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Connect an account first
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              AI personalization is configured per connected mailbox. Add Gmail or Outlook
              in Connections, then return here to set writing style and draft instructions.
            </p>
            <Button asChild className="mt-6">
              <Link href="/settings/connections">Go to Connections</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                  <Bot className="h-5 w-5 text-brand-strong" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Per-account AI</CardTitle>
                  <CardDescription>
                    Control which accounts Relay may analyze and how reply drafts should
                    sound.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiPreferences.map((preference) => (
                <AiPreferenceEditor
                  key={preference.accountId}
                  preference={preference}
                  onSaved={(updated) =>
                    setAiPreferences((current) =>
                      current.map((item) =>
                        item.accountId === updated.accountId ? updated : item,
                      ),
                    )
                  }
                />
              ))}
              <p className="text-xs leading-5 text-muted-foreground">
                AI preferences are isolated per connected account. Relay generates drafts for
                review and never sends them automatically.
              </p>
            </CardContent>
          </Card>
          <MemoryReview />
        </div>
      )}
    </SettingsShell>
  )
}

function MemoryReview() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [profile, setProfile] = useState<MemoryProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()

  const loadMemory = useCallback(async () => {
    try {
      const result = await emailApi.listMemory()
      setMemories(result.memories)
      setProfile(result.profile)
    } catch (error) {
      console.error("[Settings] Failed to load memory:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMemory()
  }, [loadMemory])

  const run = async (memory: MemoryItem, action: "accept" | "reject" | "archive") => {
    setBusyId(memory.id)
    try {
      const result = await emailApi.updateMemory({ id: memory.id, action })
      if (result.memory) {
        setMemories((current) => current.map((item) => item.id === memory.id ? result.memory! : item))
      }
    } catch (error: any) {
      toast({ title: "Memory update failed", description: error.message || "Try again.", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (memory: MemoryItem) => {
    setBusyId(memory.id)
    try {
      await emailApi.deleteMemory(memory.id)
      setMemories((current) => current.filter((item) => item.id !== memory.id))
    } catch (error: any) {
      toast({ title: "Could not delete memory", description: error.message || "Try again.", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const setLearning = async (enabled: boolean) => {
    try {
      await emailApi.updateMemory({ action: "setLearning", learningEnabled: enabled })
      setProfile((current) => current ? { ...current, learning_enabled: enabled } : current)
    } catch (error: any) {
      toast({ title: "Could not update learning", description: error.message || "Try again.", variant: "destructive" })
    }
  }

  const pending = memories.filter((memory) => memory.status === "pending")
  const accepted = memories.filter((memory) => memory.status === "accepted")

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-medium">What Relay remembers</CardTitle>
            <CardDescription>
              Review learned preferences before they affect future drafts.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="memory-learning" className="text-xs text-muted-foreground">Learning</Label>
            <Switch
              id="memory-learning"
              checked={profile?.learning_enabled ?? true}
              onCheckedChange={(checked) => void setLearning(checked)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading memory...
          </div>
        ) : !pending.length && !accepted.length ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Relay has no confirmed memories yet. New suggestions will appear here after you send or edit AI drafts.
          </p>
        ) : (
          <>
            <MemoryList
              title="Pending review"
              empty="No pending memories."
              memories={pending}
              busyId={busyId}
              onAccept={(memory) => void run(memory, "accept")}
              onReject={(memory) => void run(memory, "reject")}
              onDelete={remove}
            />
            <MemoryList
              title="Accepted"
              empty="No accepted memories."
              memories={accepted}
              busyId={busyId}
              onArchive={(memory) => void run(memory, "archive")}
              onDelete={remove}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function MemoryList({
  title,
  empty,
  memories,
  busyId,
  onAccept,
  onReject,
  onArchive,
  onDelete,
}: {
  title: string
  empty: string
  memories: MemoryItem[]
  busyId: string | null
  onAccept?: (memory: MemoryItem) => void
  onReject?: (memory: MemoryItem) => void
  onArchive?: (memory: MemoryItem) => void
  onDelete: (memory: MemoryItem) => void
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {!memories.length ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {memories.map((memory) => (
            <div key={memory.id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-6 text-foreground">{memory.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {memory.type} · {memory.scope} · {memory.source}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {onAccept && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busyId === memory.id} onClick={() => onAccept(memory)} aria-label="Accept memory">
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                {onReject && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busyId === memory.id} onClick={() => onReject(memory)} aria-label="Reject memory">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {onArchive && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busyId === memory.id} onClick={() => onArchive(memory)} aria-label="Archive memory">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={busyId === memory.id} onClick={() => onDelete(memory)} aria-label="Delete memory">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function AiPreferenceEditor({
  preference,
  onSaved,
}: {
  preference: AiAccountPreference
  onSaved: (preference: AiAccountPreference) => void
}) {
  const [form, setForm] = useState(preference)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => setForm(preference), [preference])

  const save = async () => {
    setIsSaving(true)
    try {
      const updated = await emailApi.updateAiPreference({
        accountId: form.accountId,
        writingStyle: form.writingStyle,
        signature: form.signature,
        draftInstructions: form.draftInstructions,
        aiEnabled: form.aiEnabled,
      })
      onSaved(updated)
      toast({
        title: "AI preferences saved",
        description: `Updated Relay AI for ${updated.accountEmail}.`,
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Apply the latest database migration and try again."
      toast({
        title: "Could not save AI preferences",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {form.accountEmail}
          </div>
          <div className="text-xs text-muted-foreground">
            Account-specific assistant context
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`ai-${form.accountId}`} className="text-xs text-muted-foreground">
            AI enabled
          </Label>
          <Switch
            id={`ai-${form.accountId}`}
            checked={form.aiEnabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, aiEnabled: checked }))
            }
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`style-${form.accountId}`}>Writing style</Label>
          <Input
            id={`style-${form.accountId}`}
            value={form.writingStyle}
            maxLength={1000}
            onChange={(event) =>
              setForm((current) => ({ ...current, writingStyle: event.target.value }))
            }
            placeholder="Concise, warm, professional…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`instructions-${form.accountId}`}>Draft instructions</Label>
          <Textarea
            id={`instructions-${form.accountId}`}
            value={form.draftInstructions}
            maxLength={2000}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                draftInstructions: event.target.value,
              }))
            }
            placeholder="Mention next steps and avoid jargon…"
            className="min-h-24"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`signature-${form.accountId}`}>Signature</Label>
          <Textarea
            id={`signature-${form.accountId}`}
            value={form.signature}
            maxLength={2000}
            onChange={(event) =>
              setForm((current) => ({ ...current, signature: event.target.value }))
            }
            placeholder={"Best,\nAlex"}
            className="min-h-24"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save AI settings
        </Button>
      </div>
    </div>
  )
}
