"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_client_secret:
    "The Microsoft client secret is invalid. In Entra, create a client secret and copy its Value (not the Secret ID) into MICROSOFT_CLIENT_SECRET, then restart Relay.",
  invalid_client_id:
    "Microsoft could not find this app registration. Check MICROSOFT_CLIENT_ID and MICROSOFT_TENANT_ID, then restart Relay.",
  invalid_redirect_uri:
    "The Outlook callback URL does not match Entra. Register the exact MICROSOFT_REDIRECT_URI as a Web redirect URI.",
  outlook_not_configured:
    "Outlook OAuth is not fully configured. Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI, then restart Relay.",
  guest_mailbox_unavailable:
    "Microsoft signed in an Entra guest identity instead of the Outlook mailbox owner. Set MICROSOFT_TENANT_ID=common (or consumers for personal-only accounts), restart Relay, and connect the original Outlook account again.",
  mailbox_unavailable:
    "The selected Microsoft identity has no accessible Outlook mailbox. For personal Outlook accounts, use MICROSOFT_TENANT_ID=common and reconnect.",
  missing_mail_permissions:
    "Microsoft did not grant mailbox access. Confirm delegated Mail.ReadWrite and Mail.Send permissions in Entra, then reconnect the account.",
  access_denied: "Microsoft account access was cancelled or denied.",
  no_code: "Microsoft did not return an authorization code. Try connecting the account again.",
  auth_failed:
    "Microsoft authentication failed. Check the server log for the Microsoft AADSTS error code.",
}

export function useSettingsOAuthToast(clearPath = "/settings/connections") {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    if (searchParams.get("calendarConnected")) {
      toast({
        title: "Calendar connected",
        description: "Relay can now create reminders only after you approve them.",
      })
      window.history.replaceState({}, document.title, clearPath)
      return
    }

    const calendarError = searchParams.get("calendarError")
    if (calendarError) {
      toast({
        title: "Calendar connection failed",
        description: calendarError,
        variant: "destructive",
      })
      window.history.replaceState({}, document.title, clearPath)
      return
    }

    const error = searchParams.get("error")
    if (!error) return

    toast({
      title: "Authentication Error",
      description:
        searchParams.get("provider") === "outlook"
          ? OAUTH_ERROR_MESSAGES[error] || `Failed to connect Outlook account: ${error}`
          : `Failed to connect Gmail account: ${error}`,
      variant: "destructive",
    })
    window.history.replaceState({}, document.title, clearPath)
  }, [clearPath, searchParams, toast])
}
