import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { AiChatAttachmentsProvider } from "@/components/ai-chat-attachments-provider"
import { EmailContextMenuProvider } from "@/components/email-context-menu-provider"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: "Relay",
  description:
    "A minimal AI email workspace for Gmail and Outlook — briefs, drafts, and commitments in one place.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider defaultTheme="dark">
          <AuthProvider>
            <AiChatAttachmentsProvider>
              <EmailContextMenuProvider>
                {children}
              </EmailContextMenuProvider>
            </AiChatAttachmentsProvider>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
