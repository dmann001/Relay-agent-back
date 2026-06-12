"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Mail, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { emailApi, type ConnectedAccount } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"

export function SettingsContent() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await emailApi.listAccounts())
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

  useEffect(() => {
    const error = searchParams.get("error")
    if (!error) return

    toast({
      title: "Authentication Error",
      description: `Failed to connect Gmail account: ${error}`,
      variant: "destructive",
    })
    window.history.replaceState({}, document.title, "/settings")
  }, [searchParams, toast])

  const handleConnectGmail = async () => {
    setIsConnecting(true)
    try {
      window.location.href = await emailApi.getGmailConnectUrl()
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to start Gmail authentication",
        variant: "destructive",
      })
      setIsConnecting(false)
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

        <Card
          className="rounded-2xl border border-border bg-card shadow-sm"
        >
          <CardHeader>
            <CardTitle className="font-medium text-card-foreground">Connected Accounts</CardTitle>
            <CardDescription className="text-muted-foreground">
              Manage Gmail accounts connected through OAuth.
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
                  Connect Gmail to sync, read, and send email.
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
                      <Mail className="h-5 w-5 text-brand-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">Gmail</div>
                      <div className="truncate text-sm text-muted-foreground">{account.email}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handleDisconnect(account.id)}
                    className="rounded-lg border border-border bg-transparent text-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              ))
            )}

            <Button
              className="w-full rounded-xl bg-brand font-medium text-brand-foreground hover:bg-brand-strong"
              onClick={handleConnectGmail}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Connect Gmail Account
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
