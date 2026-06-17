"use client"

import { useEffect, useState } from "react"
import { Loader2, LogOut, Mail, Save, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { SettingsShell } from "@/components/settings/settings-shell"
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

export function ProfileSettings() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [fullName, setFullName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const name =
      (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      ""
    setFullName(name)
  }, [user])

  const email = user?.email || ""
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null

  const saveProfile = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() || null },
      })
      if (error) throw error
      toast({
        title: "Profile updated",
        description: "Your display name has been saved.",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not update profile."
      toast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SettingsShell
      title="Profile"
      description="Your Relay account details and sign-in identity."
    >
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
              <UserRound className="h-5 w-5 text-brand-strong" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">Personal information</CardTitle>
              <CardDescription>
                This is how you appear in Relay. Your login email cannot be changed here.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your name"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="profile-email"
                value={email}
                readOnly
                className="bg-surface-subtle pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used to sign in to Relay. Managed through your authentication provider.
            </p>
          </div>

          {createdAt && (
            <p className="text-xs text-muted-foreground">Member since {createdAt}</p>
          )}

          <div className="flex justify-end">
            <Button onClick={() => void saveProfile()} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Session</CardTitle>
          <CardDescription>Sign out of Relay on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => void signOut()}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </SettingsShell>
  )
}
