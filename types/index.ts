export interface EmailAddress {
  name: string
  email: string
}

export interface EmailAttachment {
  filename: string
  mimeType: string
  size: number
  attachmentId?: string
  data?: string
}

export interface Email {
  id: string
  threadId: string
  from: EmailAddress & { avatar?: string }
  to: EmailAddress[]
  cc?: EmailAddress[]
  subject: string
  body: string
  bodyPlain: string
  date: string
  read: boolean
  labels: string[]
  provider: "gmail"
  accountId?: string
  accountEmail?: string
  messageId?: string
  gmailCategory?: "primary" | "promotions" | "social" | "updates" | "forums"
  hasAttachments?: boolean
  attachments?: EmailAttachment[]
  snippet?: string
  isTrashed?: boolean
  isStarred?: boolean
  isArchived?: boolean
  archivedAt?: string
}
