"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export interface AiChatEmailAttachment {
  messageId: string
  accountId?: string
  subject: string
  fromName?: string
}

interface AiChatAttachmentsContextValue {
  attachments: AiChatEmailAttachment[]
  addAttachment: (attachment: AiChatEmailAttachment) => boolean
  removeAttachment: (messageId: string, accountId?: string) => void
  clearAttachments: () => void
}

const AiChatAttachmentsContext = createContext<AiChatAttachmentsContextValue | null>(null)

function attachmentKey(messageId: string, accountId?: string) {
  return `${accountId || "default"}:${messageId}`
}

export function AiChatAttachmentsProvider({ children }: { children: ReactNode }) {
  const [attachments, setAttachments] = useState<AiChatEmailAttachment[]>([])

  const addAttachment = useCallback((attachment: AiChatEmailAttachment) => {
    let added = false
    setAttachments((current) => {
      const key = attachmentKey(attachment.messageId, attachment.accountId)
      if (current.some((item) => attachmentKey(item.messageId, item.accountId) === key)) {
        return current
      }
      added = true
      return [...current, attachment]
    })
    return added
  }, [])

  const removeAttachment = useCallback((messageId: string, accountId?: string) => {
    const key = attachmentKey(messageId, accountId)
    setAttachments((current) => current.filter((item) => attachmentKey(item.messageId, item.accountId) !== key))
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  const value = useMemo(
    () => ({ attachments, addAttachment, removeAttachment, clearAttachments }),
    [addAttachment, attachments, clearAttachments, removeAttachment],
  )

  return (
    <AiChatAttachmentsContext.Provider value={value}>
      {children}
    </AiChatAttachmentsContext.Provider>
  )
}

export function useAiChatAttachments() {
  const context = useContext(AiChatAttachmentsContext)
  if (!context) {
    throw new Error("useAiChatAttachments must be used within AiChatAttachmentsProvider")
  }
  return context
}

export function useAiChatAttachmentsOptional() {
  return useContext(AiChatAttachmentsContext)
}
