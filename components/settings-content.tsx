"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Mail, Trash2, Eye, EyeOff, Save, Loader2 } from "lucide-react"
import { storage } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"
import type { EmailAccount, AppSettings } from "@/types"

export function SettingsContent() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [openaiKey, setOpenaiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Load data from localStorage on mount
  useEffect(() => {
    const loadedAccounts = storage.getAccounts()
    const loadedSettings = storage.getSettings()
    setAccounts(loadedAccounts)
    setSettings(loadedSettings)
    setOpenaiKey(loadedSettings.openaiApiKey || "")
  }, [])

  // Handle OAuth callback
  useEffect(() => {
    const gmailAuth = searchParams.get("gmail_auth")
    const accountData = searchParams.get("account")
    const error = searchParams.get("error")

    if (error) {
      toast({
        title: "Authentication Error",
        description: `Failed to connect Gmail account: ${error}`,
        variant: "destructive",
      })
    }

    if (gmailAuth === "success" && accountData) {
      try {
        const account = JSON.parse(decodeURIComponent(accountData))
        const newAccount: EmailAccount = {
          id: account.id,
          email: account.email,
          provider: "gmail",
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          expiryDate: account.expiryDate,
          connectedAt: new Date().toISOString(),
        }
        storage.addAccount(newAccount)
        setAccounts(storage.getAccounts())
        toast({
          title: "Success",
          description: `Gmail account ${account.email} connected successfully!`,
        })
        // Clean up URL
        window.history.replaceState({}, document.title, "/settings")
      } catch (error) {
        console.error("Error processing account data:", error)
      }
    }
  }, [searchParams, toast])

  const handleConnectGmail = async () => {
    setIsConnecting(true)
    try {
      const response = await fetch("/api/auth/gmail")
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate Gmail authentication",
        variant: "destructive",
      })
      setIsConnecting(false)
    }
  }

  const handleDisconnect = (accountId: string) => {
    storage.removeAccount(accountId)
    setAccounts(storage.getAccounts())
    toast({
      title: "Account Disconnected",
      description: "Email account has been disconnected",
    })
  }

  const handleSaveApiKey = () => {
    setIsSaving(true)
    setTimeout(() => {
      if (settings) {
        storage.updateSettings({ openaiApiKey: openaiKey })
        setSettings(storage.getSettings())
        toast({
          title: "API Key Saved",
          description: "Your OpenAI API key has been saved successfully",
        })
      }
      setIsSaving(false)
    }, 500)
  }

  const handleToggleSetting = (key: keyof AppSettings['aiFeatures'], value: boolean) => {
    if (settings) {
      const updatedSettings = {
        ...settings,
        aiFeatures: {
          ...settings.aiFeatures,
          [key]: value,
        },
      }
      storage.updateSettings(updatedSettings)
      setSettings(updatedSettings)
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

        <Tabs defaultValue="accounts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="accounts">Account Management</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>Manage your email accounts and OAuth connections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No accounts connected</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Connect your Gmail account to start using the email agent
                    </p>
                  </div>
                ) : (
                  accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold">
                            {account.provider === "gmail" ? "Gmail" : "Outlook"}
                          </div>
                          <div className="text-sm text-muted-foreground">{account.email}</div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(account.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Disconnect
                      </Button>
                    </div>
                  ))
                )}

                <Button
                  className="w-full"
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

            <Card>
              <CardHeader>
                <CardTitle>OpenAI API Key</CardTitle>
                <CardDescription>
                  Enter your OpenAI API key to enable AI-powered email features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-key">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="openai-key"
                        type={showKey ? "text" : "password"}
                        placeholder="sk-..."
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      OpenAI Platform
                    </a>
                  </p>
                </div>
                <Button onClick={handleSaveApiKey} disabled={isSaving || !openaiKey}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save API Key
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Features</CardTitle>
                <CardDescription>Customize AI-powered email features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>AI Summaries</Label>
                    <div className="text-sm text-muted-foreground">
                      Automatically generate AI summaries for threads
                    </div>
                  </div>
                  <Switch
                    checked={settings?.aiFeatures.autoSummarize}
                    onCheckedChange={(checked) => handleToggleSetting("autoSummarize", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Smart Labels</Label>
                    <div className="text-sm text-muted-foreground">
                      Automatically categorize emails with AI labels
                    </div>
                  </div>
                  <Switch
                    checked={settings?.aiFeatures.autoLabel}
                    onCheckedChange={(checked) => handleToggleSetting("autoLabel", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Smart Replies</Label>
                    <div className="text-sm text-muted-foreground">
                      Show AI-powered reply suggestions
                    </div>
                  </div>
                  <Switch
                    checked={settings?.aiFeatures.smartReplies}
                    onCheckedChange={(checked) => handleToggleSetting("smartReplies", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Priority Inbox</Label>
                    <div className="text-sm text-muted-foreground">
                      Use AI to prioritize important emails
                    </div>
                  </div>
                  <Switch
                    checked={settings?.aiFeatures.priorityInbox}
                    onCheckedChange={(checked) => handleToggleSetting("priorityInbox", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {!settings?.openaiApiKey && (
              <Card className="border-yellow-500/50">
                <CardHeader>
                  <CardTitle className="text-yellow-600">AI Features Disabled</CardTitle>
                  <CardDescription>
                    Add your OpenAI API key in Account Management to enable AI features
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
