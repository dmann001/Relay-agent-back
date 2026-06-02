"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

  // Load data from the Supabase-backed storage cache on mount
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
    <div className="flex-1 overflow-auto bg-[#0A0A0B]">
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-8 text-3xl font-light tracking-tight text-[#FAFAF9]">Settings</h1>

        <Tabs defaultValue="accounts" className="space-y-6">
          <TabsList className="bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl">
            <TabsTrigger value="accounts" className="data-[state=active]:bg-[#E8DCC4] data-[state=active]:text-[#0A0A0B] rounded-lg text-[#8A8A8A]">Account Management</TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-[#E8DCC4] data-[state=active]:text-[#0A0A0B] rounded-lg text-[#8A8A8A]">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6">
            <Card className="border border-white/[0.06] bg-white/[0.02] rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
              <CardHeader>
                <CardTitle className="text-[#FAFAF9] font-medium">Connected Accounts</CardTitle>
                <CardDescription className="text-[#8A8A8A]">Manage your email accounts and OAuth connections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                      <Mail className="h-7 w-7 text-[#E8DCC4]" />
                    </div>
                    <h3 className="text-lg font-light text-[#FAFAF9]">No accounts connected</h3>
                    <p className="mt-2 text-sm text-[#8A8A8A]">
                      Connect your Gmail account to start using the email agent
                    </p>
                  </div>
                ) : (
                  accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
                          <Mail className="h-5 w-5 text-[#0A0A0B]" />
                        </div>
                        <div>
                          <div className="font-medium text-[#FAFAF9]">
                            Gmail
                          </div>
                          <div className="text-sm text-[#8A8A8A]">{account.email}</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDisconnect(account.id)}
                        className="border border-white/[0.08] bg-transparent text-[#FAFAF9] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 rounded-lg"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Disconnect
                      </Button>
                    </div>
                  ))
                )}

                <Button
                  className="w-full bg-gradient-to-b from-[#E8DCC4] to-[#C4A052] hover:from-[#F5EDD8] hover:to-[#D4B062] text-[#0A0A0B] font-medium rounded-xl"
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

            <Card className="border border-white/[0.06] bg-white/[0.02] rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
              <CardHeader>
                <CardTitle className="text-[#FAFAF9] font-medium">OpenAI API Key</CardTitle>
                <CardDescription className="text-[#8A8A8A]">
                  Enter your OpenAI API key to enable AI-powered email features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-key" className="text-[#FAFAF9]">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="openai-key"
                        type={showKey ? "text" : "password"}
                        placeholder="sk-..."
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        className="bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] placeholder:text-[#5A5A5A] rounded-xl focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 text-[#8A8A8A] hover:text-[#FAFAF9]"
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
                  <p className="text-xs text-[#5A5A5A]">
                    Get your API key from{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[#E8DCC4] hover:text-[#F5EDD8]"
                    >
                      OpenAI Platform
                    </a>
                  </p>
                </div>
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSaving || !openaiKey}
                  className="bg-gradient-to-b from-[#FAFAF9] to-[#E8E8E6] hover:from-[#FFFFFF] hover:to-[#F5F5F3] text-[#0A0A0B] font-medium rounded-xl"
                >
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
            <Card className="border border-white/[0.06] bg-white/[0.02] rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
              <CardHeader>
                <CardTitle className="text-[#FAFAF9] font-medium">AI Features</CardTitle>
                <CardDescription className="text-[#8A8A8A]">Customize AI-powered email features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[#FAFAF9]">AI Summaries</Label>
                    <div className="text-sm text-[#8A8A8A]">
                      Enable on-demand summaries when you click the summarize button
                    </div>
                  </div>
                  <Switch
                    checked={settings?.aiFeatures.autoSummarize}
                    onCheckedChange={(checked) => handleToggleSetting("autoSummarize", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[#FAFAF9]">Smart Labels</Label>
                    <div className="text-sm text-[#8A8A8A]">
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
                    <Label className="text-[#FAFAF9]">Smart Replies</Label>
                    <div className="text-sm text-[#8A8A8A]">
                      Enable AI reply tools (drafts and suggestions on demand)
                    </div>
                  </div>
                  <Switch
                    checked={settings?.aiFeatures.smartReplies}
                    onCheckedChange={(checked) => handleToggleSetting("smartReplies", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[#FAFAF9]">Priority Inbox</Label>
                    <div className="text-sm text-[#8A8A8A]">
                      Use AI to prioritize important emails
                    </div>
                  </div>
                  <Switch
                    checked={settings?.aiFeatures.priorityInbox}
                    onCheckedChange={(checked) => handleToggleSetting("priorityInbox", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#FAFAF9]">Your AI Context</Label>
                  <div className="text-sm text-[#8A8A8A]">
                    Tell the AI who you are and how you like to write (role, tone, sign-off, etc.).
                  </div>
                  <Textarea
                    placeholder="Example: I am Dhruv, a product manager. Prefer concise, friendly replies. Sign off with 'Thanks, Dhruv'."
                    value={settings?.userContext || ""}
                    onChange={(e) => {
                      if (!settings) return
                      const updatedSettings = { ...settings, userContext: e.target.value }
                      storage.updateSettings(updatedSettings)
                      setSettings(updatedSettings)
                    }}
                    className="bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] placeholder:text-[#5A5A5A] rounded-xl focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20"
                  />
                </div>
              </CardContent>
            </Card>

            {!settings?.openaiApiKey && (
              <Card className="border border-[#E8DCC4]/30 bg-[#E8DCC4]/[0.03] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[#E8DCC4] font-medium">AI Features Disabled</CardTitle>
                  <CardDescription className="text-[#8A8A8A]">
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
