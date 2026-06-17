"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { emailApi, type AiAccountPreference } from "@/lib/email-api"
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
      )}
    </SettingsShell>
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
