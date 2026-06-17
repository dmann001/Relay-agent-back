"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarDays, CheckCircle2, Loader2, Mail, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { emailApi, type CalendarConnection, type ConnectedAccount } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"
import { ProviderIcon } from "@/components/provider-icon"
import { SettingsShell } from "@/components/settings/settings-shell"
import { useSettingsOAuthToast } from "@/components/settings/use-settings-oauth-toast"

export function ConnectionsSettings() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connectingProvider, setConnectingProvider] = useState<"gmail" | "outlook" | null>(null)
  const { toast } = useToast()

  useSettingsOAuthToast()

  const loadAccounts = useCallback(async () => {
    try {
      const [connectedAccounts, calendars] = await Promise.all([
        emailApi.listAccounts(),
        emailApi.listCalendarConnections().catch(() => [] as CalendarConnection[]),
      ])
      setAccounts(connectedAccounts)
      setCalendarConnections(calendars)
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

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const handleConnectCalendar = async (account: ConnectedAccount) => {
    setConnectingProvider(account.provider)
    try {
      window.location.href = await emailApi.getCalendarConnectUrl(
        account.provider,
        account.id,
      )
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Calendar connection failed"
      toast({ title: "Calendar connection failed", description: message, variant: "destructive" })
      setConnectingProvider(null)
    }
  }

  const handleConnectGmail = async () => {
    setConnectingProvider("gmail")
    try {
      window.location.href = await emailApi.getGmailConnectUrl()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start Gmail authentication"
      toast({ title: "Connection failed", description: message, variant: "destructive" })
      setConnectingProvider(null)
    }
  }

  const handleConnectOutlook = async () => {
    setConnectingProvider("outlook")
    try {
      window.location.href = await emailApi.getOutlookConnectUrl()
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to start Outlook authentication"
      toast({ title: "Connection failed", description: message, variant: "destructive" })
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not disconnect the account"
      toast({ title: "Disconnect failed", description: message, variant: "destructive" })
    }
  }

  return (
    <SettingsShell
      title="Connections"
      description="Connect email accounts and optional calendar access for reminders."
    >
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Email accounts</CardTitle>
          <CardDescription>
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
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
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
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand">
                    <ProviderIcon
                      provider={account.provider}
                      className="h-5 w-5 text-brand-foreground"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {account.provider === "outlook" ? "Outlook" : "Gmail"}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {account.email}
                    </div>
                    <div
                      className={
                        account.syncStatus === "error"
                          ? "mt-1 text-xs text-destructive"
                          : "mt-1 text-xs text-muted-foreground"
                      }
                    >
                      {account.syncStatus === "error"
                        ? account.lastError || "Sync needs attention"
                        : account.lastSyncedAt
                          ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}`
                          : "Not synced yet"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {account.syncStatus === "error" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={
                        account.provider === "outlook"
                          ? handleConnectOutlook
                          : handleConnectGmail
                      }
                    >
                      Reconnect
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDisconnect(account.id)}
                    className="border-border hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className="w-full rounded-xl bg-brand font-medium text-brand-foreground hover:bg-brand-strong"
              onClick={handleConnectGmail}
              disabled={connectingProvider !== null}
            >
              {connectingProvider === "gmail" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Connect Gmail
                </>
              )}
            </Button>
            <Button
              className="w-full rounded-xl bg-[#0078d4] font-medium text-white hover:bg-[#106ebe]"
              onClick={handleConnectOutlook}
              disabled={connectingProvider !== null}
            >
              {connectingProvider === "outlook" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ProviderIcon provider="outlook" className="mr-2 h-4 w-4" />
                  Connect Outlook
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {accounts.length > 0 && (
        <Card className="mt-6 rounded-xl border border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                <CalendarDays className="h-5 w-5 text-brand-strong" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">Calendar</CardTitle>
                <CardDescription>
                  Optional calendar access for commitment reminders. Relay never creates
                  events without your approval.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map((account) => {
              const connection = calendarConnections.find(
                (item) => item.accountId === account.id && item.status === "connected",
              )
              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <ProviderIcon provider={account.provider} className="h-4 w-4" />
                      {account.email}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {connection
                        ? "Calendar permission is active."
                        : "Calendar access has not been granted."}
                    </p>
                  </div>
                  {connection ? (
                    <div className="flex items-center text-sm text-brand-strong">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Connected
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleConnectCalendar(account)}
                      disabled={connectingProvider !== null}
                    >
                      {connectingProvider === account.provider ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarDays className="mr-2 h-4 w-4" />
                      )}
                      Connect calendar
                    </Button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </SettingsShell>
  )
}
