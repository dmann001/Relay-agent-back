export const AI_CHAT_MAX_FILE_BYTES = 4 * 1024 * 1024
export const AI_CHAT_MAX_FILES = 4

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
])

const ALLOWED_EXTENSIONS = /\.(pdf|txt|csv|md|json|png|jpe?g|gif|webp)$/i

export function isAllowedChatFile(file: File) {
  if (ALLOWED_MIME_TYPES.has(file.type)) return true
  return ALLOWED_EXTENSIONS.test(file.name)
}

export async function readFileAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  let binary = ""
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
