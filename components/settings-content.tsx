"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Bot, Loader2, Mail, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { emailApi, type AiAccountPreference, type ConnectedAccount } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"
import { ProviderIcon } from "@/components/provider-icon"

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_client_secret: "The Microsoft client secret is invalid. In Entra, create a client secret and copy its Value (not the Secret ID) into MICROSOFT_CLIENT_SECRET, then restart Relay.",
  invalid_client_id: "Microsoft could not find this app registration. Check MICROSOFT_CLIENT_ID and MICROSOFT_TENANT_ID, then restart Relay.",
  invalid_redirect_uri: "The Outlook callback URL does not match Entra. Register the exact MICROSOFT_REDIRECT_URI as a Web redirect URI.",
  outlook_not_configured: "Outlook OAuth is not fully configured. Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI, then restart Relay.",
  guest_mailbox_unavailable: "Microsoft signed in an Entra guest identity instead of the Outlook mailbox owner. Set MICROSOFT_TENANT_ID=common (or consumers for personal-only accounts), restart Relay, and connect the original Outlook account again.",
  mailbox_unavailable: "The selected Microsoft identity has no accessible Outlook mailbox. For personal Outlook accounts, use MICROSOFT_TENANT_ID=common and reconnect.",
  missing_mail_permissions: "Microsoft did not grant mailbox access. Confirm delegated Mail.ReadWrite and Mail.Send permissions in Entra, then reconnect the account.",
  access_denied: "Microsoft account access was cancelled or denied.",
  no_code: "Microsoft did not return an authorization code. Try connecting the account again.",
  auth_failed: "Microsoft authentication failed. Check the server log for the Microsoft AADSTS error code.",
}

export function SettingsContent() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [aiPreferences, setAiPreferences] = useState<AiAccountPreference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connectingProvider, setConnectingProvider] = useState<"gmail" | "outlook" | null>(null)
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const loadAccounts = useCallback(async () => {
    try {
      const [connectedAccounts, preferences] = await Promise.all([
        emailApi.listAccounts(),
        emailApi.listAiPreferences().catch(() => [] as AiAccountPreference[]),
      ])
      setAccounts(connectedAccounts)
      setAiPreferences(preferences)
    } catch (error) {
      console.error("[Settings] Failed to load accounts:", error)
      toast({
        title: "Could not load accounts",
        description: "Refresh the page and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { void loadAccounts() }, [loadAccounts])

  useEffect(() => {
    const error = searchParams.get("error")
    if (!error) return
    toast({
      title: "Authentication Error",
      description: searchParams.get("provider") === "outlook"
        ? OAUTH_ERROR_MESSAGES[error] || `Failed to connect Outlook account: ${error}`
        : `Failed to connect Gmail account: ${error}`,
      variant: "destructive",
    })
    window.history.replaceState({}, document.title, "/settings")
  }, [searchParams, toast])

  const handleConnectGmail = async () => {
    setConnectingProvider("gmail")
    try {
      window.location.href = await emailApi.getGmailConnectUrl()
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to start Gmail authentication",
        variant: "destructive",
      })
      setConnectingProvider(null)
    }
  }

  const handleConnectOutlook = async () => {
    setConnectingProvider("outlook")
    try {
      window.location.href = await emailApi.getOutlookConnectUrl()
    } catch (error: any) {
      toast({ title: "Connection failed", description: error.message || "Failed to start Outlook authentication", variant: "destructive" })
      setConnectingProvider(null)
    }
  }

  const handleDisconnect = async (accountId: string) => {
    try {
      await emailApi.disconnectAccount(accountId)
      await loadAccounts()
      toast({
        title: "Account disconnected",
        description: "The account and its cached email metadata were removed.",
      })
    } catch (error: any) {
      toast({
        title: "Disconnect failed",
        description: error.message || "Could not disconnect the account",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-8 text-3xl font-light tracking-tight text-foreground">Settings</h1>

        <Card className="rounded-2xl border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-medium text-card-foreground">Connected Accounts</CardTitle>
            <CardDescription className="text-muted-foreground">
              Manage Gmail and Outlook accounts connected through OAuth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle">
                  <Mail className="h-7 w-7 text-brand" />
                </div>
                <h3 className="text-lg font-light text-foreground">No accounts connected</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Connect Gmail or Outlook to sync, read, and send email.
                </p>
              </div>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-subtle p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand">
                      <ProviderIcon provider={account.provider} className="h-5 w-5 text-brand-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{account.provider === "outlook" ? "Outlook" : "Gmail"}</div>
                      <div className="truncate text-sm text-muted-foreground">{account.email}</div>
                      <div className={account.syncStatus === "error" ? "mt-1 text-xs text-destructive" : "mt-1 text-xs text-muted-foreground"}>{account.syncStatus === "error" ? account.lastError || "Sync needs attention" : account.lastSyncedAt ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}` : "Not synced yet"}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                  {account.syncStatus === "error" && <Button size="sm" variant="outline" onClick={account.provider === "outlook" ? handleConnectOutlook : handleConnectGmail}>Reconnect</Button>}
                  <Button
                    size="sm"
                    onClick={() => void handleDisconnect(account.id)}
                    className="rounded-lg border border-border bg-transparent text-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                  </div>
                </div>
              ))
            )}

            <div className="grid gap-3 sm:grid-cols-2">
            <Button className="w-full rounded-xl bg-brand font-medium text-brand-foreground hover:bg-brand-strong" onClick={handleConnectGmail} disabled={connectingProvider !== null}>
              {connectingProvider === "gmail" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</>
              ) : (
                <><Mail className="mr-2 h-4 w-4" />Connect Gmail Account</>
              )}
            </Button>
            <Button className="w-full rounded-xl bg-[#0078d4] font-medium text-white hover:bg-[#106ebe]" onClick={handleConnectOutlook} disabled={connectingProvider !== null}>
              {connectingProvider === "outlook" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</> : <><ProviderIcon provider="outlook" className="mr-2 h-4 w-4" />Connect Outlook Account</>}
            </Button>
            </div>
          </CardContent>
        </Card>

        {aiPreferences.length > 0 && (
          <Card className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                  <Bot className="h-5 w-5 text-brand-strong" />
                </div>
                <div>
                  <CardTitle className="font-medium text-card-foreground">Relay AI by account</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Control which accounts Relay may analyze and how reply drafts should sound.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiPreferences.map((preference) => (
                <AiPreferenceEditor
                  key={preference.accountId}
                  preference={preference}
                  onSaved={(updated) => setAiPreferences((current) =>
                    current.map((item) => item.accountId === updated.accountId ? updated : item)
                  )}
                />
              ))}
              <p className="text-xs leading-5 text-muted-foreground">
                AI preferences are isolated per connected account. Relay generates drafts for review
                and never sends them automatically.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
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
      toast({ title: "AI preferences saved", description: `Updated Relay AI for ${updated.accountEmail}.` })
    } catch (error: any) {
      toast({
        title: "Could not save AI preferences",
        description: error.message || "Apply the latest database migration and try again.",
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
          <div className="truncate text-sm font-medium text-foreground">{form.accountEmail}</div>
          <div className="text-xs text-muted-foreground">Account-specific assistant context</div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`ai-${form.accountId}`} className="text-xs text-muted-foreground">AI enabled</Label>
          <Switch
            id={`ai-${form.accountId}`}
            checked={form.aiEnabled}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, aiEnabled: checked }))}
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
            onChange={(event) => setForm((current) => ({ ...current, writingStyle: event.target.value }))}
            placeholder="Concise, warm, professional…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`instructions-${form.accountId}`}>Draft instructions</Label>
          <Textarea
            id={`instructions-${form.accountId}`}
            value={form.draftInstructions}
            maxLength={2000}
            onChange={(event) => setForm((current) => ({ ...current, draftInstructions: event.target.value }))}
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
            onChange={(event) => setForm((current) => ({ ...current, signature: event.target.value }))}
            placeholder={"Best,\nAlex"}
            className="min-h-24"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save AI settings
        </Button>
      </div>
    </div>
  )
}
