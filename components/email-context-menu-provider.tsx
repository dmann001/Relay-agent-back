"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  Bot,
  Mail,
  MailOpen,
  MessageSquareReply,
  Trash2,
} from "lucide-react"
import { emailApi } from "@/lib/email-api"
import type { Email } from "@/types"
import { useAiChatAttachments } from "@/components/ai-chat-attachments-provider"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type EmailContextMenuState = {
  email: Email
  x: number
  y: number
} | null

interface EmailContextMenuContextValue {
  openEmailContextMenu: (event: MouseEvent, email: Email) => void
}

const EmailContextMenuContext = createContext<EmailContextMenuContextValue | null>(null)

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: typeof Mail
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover",
        destructive ? "text-destructive" : "text-foreground",
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      {label}
    </button>
  )
}

export function EmailContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<EmailContextMenuState>(null)
  const router = useRouter()
  const { toast } = useToast()
  const { addAttachment } = useAiChatAttachments()

  const closeMenu = useCallback(() => setMenu(null), [])

  const openEmailContextMenu = useCallback((event: MouseEvent, email: Email) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ email, x: event.clientX, y: event.clientY })
  }, [])

  useEffect(() => {
    if (!menu) return
    const onPointerDown = () => closeMenu()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu()
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", closeMenu, true)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", closeMenu, true)
    }
  }, [closeMenu, menu])

  const runAction = useCallback(async (
    action: "archive" | "trash" | "markRead" | "markUnread",
  ) => {
    if (!menu) return
    const email = menu.email
    closeMenu()
    try {
      await emailApi.modifyEmail(email.id, action, email.accountId)
      window.dispatchEvent(new Event("relay-emails-updated"))
      toast({
        title: action === "archive"
          ? "Email archived"
          : action === "trash"
            ? "Moved to trash"
            : action === "markRead"
              ? "Marked as read"
              : "Marked as unread",
      })
    } catch (error: any) {
      toast({
        title: "Action failed",
        description: error.message || "Could not update this email.",
        variant: "destructive",
      })
    }
  }, [closeMenu, menu, toast])

  const value = useMemo(() => ({ openEmailContextMenu }), [openEmailContextMenu])

  const openEmail = () => {
    if (!menu) return
    const email = menu.email
    closeMenu()
    router.push(`/inbox?message=${encodeURIComponent(email.id)}&messageAccount=${encodeURIComponent(email.accountId || "")}`)
  }

  const replyToEmail = () => {
    if (!menu) return
    const email = menu.email
    closeMenu()
    router.push(`/inbox?message=${encodeURIComponent(email.id)}&messageAccount=${encodeURIComponent(email.accountId || "")}`)
  }

  const addToChat = () => {
    if (!menu) return
    const email = menu.email
    const added = addAttachment({
      messageId: email.id,
      accountId: email.accountId,
      subject: email.subject,
      fromName: email.from.name,
    })
    closeMenu()
    toast({
      title: added ? "Added to AI chat" : "Already in AI chat",
      description: email.subject,
    })
    router.push("/inbox?assistant=chat")
  }

  return (
    <EmailContextMenuContext.Provider value={value}>
      {children}
      {menu && (
        <div
          className="fixed z-[100] min-w-52 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          style={{
            top: Math.min(menu.y, window.innerHeight - 320),
            left: Math.min(menu.x, window.innerWidth - 220),
          }}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          aria-label="Email actions"
        >
          <div className="mb-1 border-b border-border px-2.5 py-2">
            <div className="truncate text-xs font-medium text-foreground">{menu.email.subject || "(No subject)"}</div>
            <div className="truncate text-[11px] text-muted-foreground">{menu.email.from.name}</div>
          </div>
          <MenuItem icon={Mail} label="Open" onClick={openEmail} />
          <MenuItem icon={MessageSquareReply} label="Reply" onClick={replyToEmail} />
          <MenuItem
            icon={menu.email.read ? Mail : MailOpen}
            label={menu.email.read ? "Mark unread" : "Mark read"}
            onClick={() => void runAction(menu.email.read ? "markUnread" : "markRead")}
          />
          <MenuItem icon={Archive} label="Archive" onClick={() => void runAction("archive")} />
          <MenuItem icon={Trash2} label="Move to trash" onClick={() => void runAction("trash")} destructive />
          <div className="my-1 border-t border-border" />
          <MenuItem icon={Bot} label="Add to chat" onClick={addToChat} />
        </div>
      )}
    </EmailContextMenuContext.Provider>
  )
}

export function useEmailContextMenu() {
  const context = useContext(EmailContextMenuContext)
  if (!context) {
    throw new Error("useEmailContextMenu must be used within EmailContextMenuProvider")
  }
  return context
}

export function useEmailContextMenuOptional() {
  return useContext(EmailContextMenuContext)
}