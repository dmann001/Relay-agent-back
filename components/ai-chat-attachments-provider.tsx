"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export interface AiChatEmailAttachment {
  messageId: string
  accountId?: string
  subject: string
  fromName?: string
}

export interface AiChatFileAttachment {
  id: string
  filename: string
  mimeType: string
  data: string
  size: number
}

interface AiChatAttachmentsContextValue {
  attachments: AiChatEmailAttachment[]
  fileAttachments: AiChatFileAttachment[]
  addAttachment: (attachment: AiChatEmailAttachment) => boolean
  removeAttachment: (messageId: string, accountId?: string) => void
  addFileAttachment: (attachment: AiChatFileAttachment) => boolean
  removeFileAttachment: (id: string) => void
  clearAttachments: () => void
}

const AiChatAttachmentsContext = createContext<AiChatAttachmentsContextValue | null>(null)

function attachmentKey(messageId: string, accountId?: string) {
  return `${accountId || "default"}:${messageId}`
}

export function AiChatAttachmentsProvider({ children }: { children: ReactNode }) {
  const [attachments, setAttachments] = useState<AiChatEmailAttachment[]>([])
  const [fileAttachments, setFileAttachments] = useState<AiChatFileAttachment[]>([])

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

  const addFileAttachment = useCallback((attachment: AiChatFileAttachment) => {
    let added = false
    setFileAttachments((current) => {
      if (current.length >= 4) return current
      if (current.some((item) => item.id === attachment.id)) return current
      added = true
      return [...current, attachment]
    })
    return added
  }, [])

  const removeFileAttachment = useCallback((id: string) => {
    setFileAttachments((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
    setFileAttachments([])
  }, [])

  const value = useMemo(
    () => ({
      attachments,
      fileAttachments,
      addAttachment,
      removeAttachment,
      addFileAttachment,
      removeFileAttachment,
      clearAttachments,
    }),
    [addAttachment, attachments, clearAttachments, fileAttachments, addFileAttachment, removeAttachment, removeFileAttachment],
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
